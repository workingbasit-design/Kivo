'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import {
  buildJobReminderDraft,
  buildInvoiceFollowupDraft,
  buildMissedCallDraft,
  formatWhenLabel,
} from '@/lib/reminders';

export type DraftResult = { text?: string; error?: string };

/**
 * Build a polite, bilingual job-reminder draft for one job.
 * Never sends anything — returns draft text only.
 */
export async function draftJobReminder(jobId: string): Promise<DraftResult> {
  const { businessId } = await requireAuth();
  const locale: Locale = await getLocale();

  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId },
    include: {
      customer: { select: { name: true } },
      business: { select: { name: true } },
    },
  });
  if (!job) return { error: t(locale, 'reminders.errors.notFound') };

  const text = buildJobReminderDraft({
    locale,
    businessName: job.business.name,
    customerName: job.customer.name,
    jobTitle: job.title,
    whenLabel: formatWhenLabel(job.date, job.time, locale),
  });
  return { text };
}

/**
 * Build a polite, bilingual invoice follow-up draft for one invoice.
 * Mentions Interac e-Transfer when the business has interacEmail set
 * (text only — EveryJob never processes payments). Never sends anything.
 */
export async function draftInvoiceFollowup(invoiceId: string): Promise<DraftResult> {
  const { businessId } = await requireAuth();
  const locale: Locale = await getLocale();

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId },
    include: {
      customer: { select: { name: true } },
      payments: { select: { amount: true } },
      business: { select: { name: true, interacEmail: true, currency: true } },
    },
  });
  if (!invoice) return { error: t(locale, 'reminders.errors.notFound') };

  const paid = Math.round(invoice.payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  const remaining = Math.round((invoice.total - paid) * 100) / 100;
  if (remaining <= 0) return { error: t(locale, 'reminders.errors.alreadyPaid') };

  const text = buildInvoiceFollowupDraft({
    locale,
    businessName: invoice.business.name,
    customerName: invoice.customer.name,
    invoiceNumber: invoice.number,
    amountLabel: formatMoney(remaining, invoice.business.currency, locale),
    interacEmail: invoice.business.interacEmail,
  });
  return { text };
}

/**
 * Build a manual "sorry I missed your call" text-back draft for a customer.
 * EveryJob has no telephony integration — this is a quick-draft the owner
 * sends themselves, never automatic detection.
 */
export async function draftMissedCall(customerId: string): Promise<DraftResult> {
  const { businessId } = await requireAuth();
  const locale: Locale = await getLocale();

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    select: { name: true, phone: true },
  });
  if (!customer) return { error: t(locale, 'reminders.errors.notFound') };

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });

  const text = buildMissedCallDraft({
    locale,
    businessName: business?.name ?? 'EveryJob',
    customerName: customer.name,
  });
  return { text };
}
