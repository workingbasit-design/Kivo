'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';

export type ActionResult = { error?: string; ok?: boolean };

async function clientKey(prefix: string): Promise<string> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown';
  return `${prefix}:${ip}`;
}

function checkLimit(key: string): ActionResult | null {
  const rl = rateLimit(key, ACTION_LIMIT);
  if (!rl.ok) {
    const secs = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
    return { error: `Too many requests. Try again in ${secs}s.` };
  }
  return null;
}

/** Stripe connection + recent online payments for Settings → Payments. */
export async function getStripeDashboard() {
  const { businessId } = await requireAuth();
  const connection = await prisma.stripeConnection.findUnique({ where: { businessId } });
  const payments = await prisma.payment.findMany({
    where: { invoice: { businessId }, provider: 'STRIPE' },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: {
      id: true, amount: true, status: true, receiptUrl: true, createdAt: true,
      invoice: { select: { number: true, customer: { select: { name: true } } } },
    },
  });
  const deposits = await prisma.quoteDeposit.findMany({
    where: { businessId, provider: 'STRIPE' },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: {
      id: true, amount: true, status: true, receiptUrl: true, createdAt: true,
      quote: { select: { number: true, customer: { select: { name: true } } } },
    },
  });
  return {
    connection: connection
      ? {
          stripeAccountId: connection.stripeAccountId,
          livemode: connection.livemode,
          chargesEnabled: connection.chargesEnabled,
          payoutsEnabled: connection.payoutsEnabled,
          onboardingComplete: connection.onboardingComplete,
          liveConfirmedAt: connection.liveConfirmedAt?.toISOString() ?? null,
          createdAt: connection.createdAt.toISOString(),
        }
      : null,
    stripeConfigured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_CLIENT_ID),
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      status: p.status,
      receiptUrl: p.receiptUrl,
      createdAt: p.createdAt.toISOString(),
      invoiceNumber: p.invoice.number,
      customerName: p.invoice.customer.name,
    })),
    deposits: deposits.map((d) => ({
      id: d.id,
      amount: d.amount,
      status: d.status,
      receiptUrl: d.receiptUrl,
      createdAt: d.createdAt.toISOString(),
      quoteNumber: d.quote.number,
      customerName: d.quote.customer.name,
    })),
  };
}

/**
 * Explicit owner confirmation before LIVE charges are accepted. Test-mode
 * connections never need this; the "Pay now" button stays in test mode until
 * the owner checks this box.
 */
export async function confirmLivePaymentsAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('stripe:live'));
  if (limited) return limited;
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }
  if (formData.get('confirm') !== 'yes') {
    return { error: 'Tick the confirmation box to enable live payments.' };
  }
  const conn = await prisma.stripeConnection.findUnique({ where: { businessId } });
  if (!conn) return { error: 'Connect Stripe first.' };
  if (!conn.livemode) {
    return { error: 'This Stripe account is in test mode. Live confirmation only applies to live accounts.' };
  }
  await prisma.stripeConnection.update({
    where: { businessId },
    data: { liveConfirmedAt: new Date() },
  });
  revalidatePath('/settings/payments');
  return { ok: true };
}

/** Disconnect Stripe (deletes the connection; recorded payments stay). */
export async function disconnectStripeAction(): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('stripe:connect'));
  if (limited) return limited;
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }
  await prisma.stripeConnection.deleteMany({ where: { businessId } });
  revalidatePath('/settings/payments');
  return { ok: true };
}

/** Set (or clear) the requested deposit amount on a quote. Record-only. */
export async function setQuoteDepositAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('quote:deposit'));
  if (limited) return limited;
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }
  const quoteId = String(formData.get('quoteId') ?? '');
  const raw = String(formData.get('depositAmount') ?? '').trim();
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, businessId },
    select: { id: true, total: true },
  });
  if (!quote) return { error: 'Quote not found.' };
  if (raw === '') {
    await prisma.quote.update({ where: { id: quoteId }, data: { depositAmount: null } });
  } else {
    const amount = Math.round(Number(raw) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: 'Deposit must be a positive amount.' };
    }
    if (amount > quote.total) {
      return { error: 'Deposit cannot exceed the quote total.' };
    }
    await prisma.quote.update({ where: { id: quoteId }, data: { depositAmount: amount } });
  }
  revalidatePath(`/quotes/${quoteId}`);
  return { ok: true };
}

/**
 * Record a MANUAL deposit on a quote (Interac e-Transfer, cash, cheque).
 * Record-only — no money moves through EveryJob.
 */
export async function recordManualQuoteDepositAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('quote:deposit'));
  if (limited) return limited;
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }
  const quoteId = String(formData.get('quoteId') ?? '');
  const amount = Math.round(Number(formData.get('amount') ?? 0) * 100) / 100;
  const provider = String(formData.get('provider') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 120);
  if (!['INTERAC', 'CASH', 'CHEQUE'].includes(provider)) {
    return { error: 'Choose Interac, cash or cheque for a manual deposit.' };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Amount must be positive.' };
  }
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, businessId },
    include: { deposits: { where: { status: 'COMPLETED' }, select: { amount: true } } },
  });
  if (!quote) return { error: 'Quote not found.' };
  const alreadyPaid = quote.deposits.reduce((s, d) => s + d.amount, 0);
  const requested = quote.depositAmount ?? quote.total;
  if (alreadyPaid + amount > requested + 0.009) {
    return { error: `That exceeds the requested deposit of $${requested.toFixed(2)}.` };
  }
  await prisma.quoteDeposit.create({
    data: { quoteId, businessId, amount, provider, status: 'COMPLETED', note: note || undefined },
  });
  revalidatePath(`/quotes/${quoteId}`);
  return { ok: true };
}
