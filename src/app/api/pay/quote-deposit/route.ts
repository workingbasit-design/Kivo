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
  return !rateLimit(`pay:deposit:${ip}`, ACTION_LIMIT).ok;
}

/**
 * Public "Pay deposit" for a quote. Scoped to a valid quote ShareToken.
 * Creates a PENDING QuoteDeposit row plus a Stripe Checkout Session on the
 * business's own Stripe account; the webhook flips the deposit to COMPLETED.
 * Record-only manual deposits (Interac/cash/cheque) remain available to the
 * owner alongside this online path.
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
      type: 'QUOTE',
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      quote: {
        include: {
          business: { include: { stripeConnection: true } },
          customer: { select: { email: true } },
          deposits: { where: { status: 'COMPLETED' }, select: { amount: true } },
        },
      },
    },
  });
  const quote = share?.quote;
  if (!quote) {
    return NextResponse.json({ error: 'This payment link is invalid or expired.' }, { status: 404 });
  }

  const conn = quote.business.stripeConnection;
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

  const requested = quote.depositAmount ?? quote.total;
  const paid = round2(quote.deposits.reduce((s, d) => s + d.amount, 0));
  const remaining = round2(requested - paid);
  if (remaining <= 0) {
    return NextResponse.json({ error: 'The deposit is already paid in full.' }, { status: 409 });
  }

  const deposit = await prisma.quoteDeposit.create({
    data: {
      quoteId: quote.id,
      businessId: quote.businessId,
      amount: remaining,
      provider: 'STRIPE',
      status: 'PENDING',
    },
  });

  const base = process.env.APP_BASE_URL ?? new URL(req.url).origin;
  const created = await createCheckoutSession({
    platformSecret: process.env.STRIPE_SECRET_KEY,
    stripeAccountId: conn.stripeAccountId,
    amountCents: toCents(remaining),
    currency: quote.business.currency || 'CAD',
    productName: `Deposit — Quote ${quote.number} (${quote.business.name})`,
    successUrl: `${base}/q/${token}?paid=1`,
    cancelUrl: `${base}/q/${token}`,
    customerEmail: quote.customer.email ?? undefined,
    metadata: { kind: 'quote_deposit', quote_deposit_id: deposit.id, business_id: quote.businessId },
  });
  if (!created.ok || !created.url) {
    await prisma.quoteDeposit.update({
      where: { id: deposit.id },
      data: { status: 'FAILED' },
    });
    return NextResponse.json({ error: created.error ?? 'Could not start checkout.' }, { status: 502 });
  }
  await prisma.quoteDeposit.update({
    where: { id: deposit.id },
    data: { stripeCheckoutSessionId: created.sessionId },
  });
  return NextResponse.json({ url: created.url, testMode: !conn.livemode });
}
