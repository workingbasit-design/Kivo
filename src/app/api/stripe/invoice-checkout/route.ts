import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { createInvoiceCheckout, toCents } from '@/lib/stripe';
import { getLocale } from '@/lib/i18n/server';

const round2 = (n: number) => Math.round(n * 100) / 100;

async function rateLimited(businessId: string): Promise<boolean> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown';
  return !rateLimit(`stripe:invoice-checkout:${businessId}:${ip}`, ACTION_LIMIT).ok;
}

/**
 * Owner-only: create a Stripe Checkout payment link for an invoice.
 * Tenant-scoped (invoiceId + businessId from the session). The owner sends
 * the returned URL to the customer by text/email; the customer pays on
 * Stripe's hosted page and the webhook records the payment. Direct charge
 * on the business's own connected Stripe account — EveryJob never holds
 * money and takes no fee (application_fee_amount = 0).
 */
export async function POST(req: Request) {
  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!session || !businessId) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  if (await rateLimited(businessId)) {
    return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Online payments are not configured.' }, { status: 503 });
  }

  let invoiceId = '';
  try {
    invoiceId = String((await req.json()).invoiceId ?? '');
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  if (!invoiceId) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId },
    include: {
      business: { include: { stripeConnection: true } },
      customer: { select: { email: true } },
      payments: { where: { status: 'COMPLETED' }, select: { amount: true } },
    },
  });
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  const conn = invoice.business.stripeConnection;
  if (!conn?.chargesEnabled) {
    return NextResponse.json(
      { error: 'Connect Stripe in Settings → Payments first.' },
      { status: 409 }
    );
  }
  if (conn.livemode && !conn.liveConfirmedAt) {
    return NextResponse.json(
      { error: 'Enable live payments in Settings → Payments first.' },
      { status: 409 }
    );
  }

  const paid = round2(invoice.payments.reduce((s, p) => s + p.amount, 0));
  const remaining = round2(invoice.total - paid);
  if (remaining <= 0) {
    return NextResponse.json({ error: 'This invoice is already paid in full.' }, { status: 409 });
  }

  const base = process.env.APP_BASE_URL ?? new URL(req.url).origin;
  // Land the customer on their public invoice portal after paying when a
  // share link exists; otherwise fall back to the owner's invoice page.
  const share = await prisma.shareToken.findFirst({
    where: {
      invoiceId: invoice.id,
      businessId,
      type: 'INVOICE',
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { token: true },
    orderBy: { createdAt: 'desc' },
  });
  const successUrl = share ? `${base}/i/${share.token}?paid=1` : `${base}/invoices/${invoice.id}`;
  const cancelUrl = share ? `${base}/i/${share.token}` : `${base}/invoices/${invoice.id}`;

  const locale = await getLocale();
  const created = await createInvoiceCheckout({
    platformSecret: process.env.STRIPE_SECRET_KEY,
    stripeAccountId: conn.stripeAccountId,
    invoice: { id: invoice.id, number: invoice.number },
    business: {
      id: invoice.businessId,
      name: invoice.business.name,
      currency: invoice.business.currency,
    },
    amountCents: toCents(remaining),
    successUrl,
    cancelUrl,
    customerEmail: invoice.customer.email ?? undefined,
    checkoutLocale: locale,
  });
  if (!created.ok || !created.url) {
    return NextResponse.json({ error: created.error ?? 'Could not start checkout.' }, { status: 502 });
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { stripeCheckoutSessionId: created.sessionId },
  });

  return NextResponse.json({ url: created.url, testMode: !conn.livemode, amount: remaining });
}
