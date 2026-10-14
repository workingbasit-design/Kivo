import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { createCheckoutSession, type CheckoutSessionResult } from '@/lib/stripe';
import { withRetry, newIdempotencyKey } from '@/lib/retry';
import { clientIpFromHeaders } from '@/lib/client-ip';
import { unsafeUnscoped } from '@/lib/tenant-guard';

async function rateLimited(): Promise<boolean> {
  const h = await headers();
  const ip = clientIpFromHeaders(h);
  return !rateLimit(`pay:invoice:${ip}`, ACTION_LIMIT).ok;
}

/**
 * Public "Pay now" for an invoice. Scoped to a valid invoice ShareToken -
 * the raw invoice id is never accepted. Creates a Stripe Checkout Session on
 * the BUSINESS's own connected Stripe account (direct charge; EveryJob never
 * holds money) and returns the Stripe-hosted URL. The customer pays on
 * Stripe's page - card data never touches our servers.
 */
export async function POST(req: Request) {
  const limited = await rateLimited();
  if (limited) {
    return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Online payments are not configured.' }, { status: 503 });
  }
  const platformSecret = process.env.STRIPE_SECRET_KEY;

  let token = '';
  try {
    token = String((await req.json()).token ?? '');
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  if (!token) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  // Public payment entry point: the 256-bit token IS the authorization.
  // The business is learned from the resolved row, so no tenant scope can
  // exist before this lookup; the token row is usability-checked
  // (revokedAt/expiresAt) before anything renders.
  const share = await unsafeUnscoped('pay:invoice:resolveShare', (db) =>
    db.shareToken.findFirst({
      where: {
        token,
        type: 'INVOICE',
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        invoice: {
          include: {
            business: { include: { stripeConnection: true } },
            customer: { select: { email: true } },
            payments: { where: { status: 'COMPLETED' }, select: { amountCents: true } },
          },
        },
      },
    })
  );
  const invoice = share?.invoice;
  if (!invoice) {
    return NextResponse.json({ error: 'This payment link is invalid or expired.' }, { status: 404 });
  }

  const conn = invoice.business.stripeConnection;
  if (!conn?.chargesEnabled) {
    return NextResponse.json(
      { error: 'Online card payment is not enabled for this business.' },
      { status: 409 }
    );
  }
  if (conn.livemode && !conn.liveConfirmedAt) {
    return NextResponse.json(
      { error: 'Online payments are not enabled yet. Please contact the business.' },
      { status: 409 }
    );
  }

  const paidCents = invoice.payments.reduce((s, p) => s + p.amountCents, BigInt(0));
  const remainingCents = invoice.totalCents - paidCents;
  if (remainingCents <= BigInt(0)) {
    return NextResponse.json({ error: 'This invoice is already paid in full.' }, { status: 409 });
  }

  const base = process.env.APP_BASE_URL ?? new URL(req.url).origin;
  // B10.3: safe retries with an idempotency key - a retried request can
  // never create two Checkout Sessions (Stripe honors Idempotency-Key).
  const idemKey = newIdempotencyKey('checkout');
  const created = (await withRetry(
    async () =>
      createCheckoutSession({
        platformSecret,
        stripeAccountId: conn.stripeAccountId,
        amountCents: Number(remainingCents),
        currency: invoice.business.currency || 'CAD',
        productName: `Invoice ${invoice.number} - ${invoice.business.name}`,
        successUrl: `${base}/i/${token}?paid=1`,
        cancelUrl: `${base}/i/${token}`,
        customerEmail: invoice.customer.email ?? undefined,
        metadata: { kind: 'invoice', invoice_id: invoice.id, business_id: invoice.businessId },
        idempotencyKey: idemKey,
      }),
    idemKey,
    { timeoutMs: 15_000 }
  )) as CheckoutSessionResult;
  if (!created.ok || !created.url) {
    return NextResponse.json({ error: created.error ?? 'Could not start checkout.' }, { status: 502 });
  }
  return NextResponse.json({ url: created.url, testMode: !conn.livemode });
}
