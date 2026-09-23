import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { createCheckoutSession, toCents } from '@/lib/stripe';

const round2 = (n: number) => Math.round(n * 100) / 100;

async function rateLimited(): Promise<boolean> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown';
  return !rateLimit(`pay:invoice:${ip}`, ACTION_LIMIT).ok;
}

/**
 * Public "Pay now" for an invoice. Scoped to a valid invoice ShareToken —
 * the raw invoice id is never accepted. Creates a Stripe Checkout Session on
 * the BUSINESS's own connected Stripe account (direct charge; EveryJob never
 * holds money) and returns the Stripe-hosted URL. The customer pays on
 * Stripe's page — card data never touches our servers.
 */
export async function POST(req: Request) {
  const limited = await rateLimited();
  if (limited) {
    return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Online payments are not configured.' }, { status: 503 });
  }

  let token = '';
  try {
    token = String((await req.json()).token ?? '');
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  if (!token) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  const share = await prisma.shareToken.findFirst({
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
          payments: { where: { status: 'COMPLETED' }, select: { amount: true } },
        },
      },
    },
  });
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

  const paid = round2(invoice.payments.reduce((s, p) => s + p.amount, 0));
  const remaining = round2(invoice.total - paid);
  if (remaining <= 0) {
    return NextResponse.json({ error: 'This invoice is already paid in full.' }, { status: 409 });
  }

  const base = process.env.APP_BASE_URL ?? new URL(req.url).origin;
  const created = await createCheckoutSession({
    platformSecret: process.env.STRIPE_SECRET_KEY,
    stripeAccountId: conn.stripeAccountId,
    amountCents: toCents(remaining),
    currency: invoice.business.currency || 'CAD',
    productName: `Invoice ${invoice.number} — ${invoice.business.name}`,
    successUrl: `${base}/i/${token}?paid=1`,
    cancelUrl: `${base}/i/${token}`,
    customerEmail: invoice.customer.email ?? undefined,
    metadata: { kind: 'invoice', invoice_id: invoice.id, business_id: invoice.businessId },
  });
  if (!created.ok || !created.url) {
    return NextResponse.json({ error: created.error ?? 'Could not start checkout.' }, { status: 502 });
  }
  return NextResponse.json({ url: created.url, testMode: !conn.livemode });
}
