'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { getTaxConfig, totalTaxRate, type TaxConfig } from '@/lib/tax';
import {
  todayInTimezone,
  toISODateLocal,
} from '@/lib/utils';
import { localMidnight } from '@/lib/google-calendar';
import {
  buildBatchPreview,
  validateMilestoneInput,
  type BatchPreviewRow,
} from '@/lib/billing';

export type BatchPreviewResult = { error?: string; rows?: BatchPreviewRow[] };
export type ConfirmBatchResult = { error?: string; ok?: boolean; created?: number };
export type MilestoneResult = { error?: string; ok?: boolean; invoiceId?: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

async function clientKey(prefix: string): Promise<string> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown';
  return `${prefix}:${ip}`;
}

function checkLimit(key: string, locale: Locale): ConfirmBatchResult | null {
  const rl = rateLimit(key, ACTION_LIMIT);
  if (!rl.ok) return { error: t(locale, 'billing.errors.tooMany') };
  return null;
}

/** Load this business's tax config (region-aware defaults for new invoices). */
async function businessTaxConfig(businessId: string): Promise<TaxConfig> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { regionCode: true, taxRegion: true },
  });
  return getTaxConfig(business?.regionCode, business?.taxRegion);
}

type DbClient = Pick<typeof prisma, 'invoice'>;

/** Next INV-0001 style number, scoped per business, retry-safe. */
async function nextInvoiceNumber(
  businessId: string,
  db: DbClient = prisma
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db.invoice.findMany({
      where: { businessId },
      select: { number: true },
    });
    let max = 0;
    for (const r of existing) {
      const m = /^INV-(\d+)$/.exec(r.number);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    const number = `INV-${String(max + 1 + attempt).padStart(4, '0')}`;
    const clash = await db.invoice.findFirst({
      where: { businessId, number },
      select: { id: true },
    });
    if (!clash) return number;
  }
  return `INV-${Date.now().toString().slice(-6)}`;
}

/**
 * Preview: completed jobs with NO invoice yet, tenant-scoped.
 * Pure read — nothing is created.
 */
export async function previewBatchInvoices(): Promise<BatchPreviewResult> {
  const locale = await getLocale();
  const limited = checkLimit(await clientKey('batch:preview'), locale);
  if (limited) return { error: limited.error };

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: t(locale, 'billing.errors.loginAgain') };
  }

  const jobs = await prisma.job.findMany({
    where: { businessId, status: 'COMPLETED', invoices: { none: {} } },
    include: { customer: { select: { name: true } } },
    orderBy: { date: 'desc' },
  });

  const taxRate = totalTaxRate(await businessTaxConfig(businessId));

  return {
    rows: buildBatchPreview(
      jobs.map((j) => ({
        id: j.id,
        title: j.title,
        price: j.price,
        customerName: j.customer.name,
        date: toISODateLocal(j.date),
      })),
      taxRate
    ),
  };
}

/**
 * Commit the batch. Preview-then-commit: EVERY jobId is re-validated
 * (belongs to this business, COMPLETED, still uninvoiced). If ANY job fails
 * validation, nothing is created.
 */
export async function confirmBatchInvoices(
  jobIds: string[]
): Promise<ConfirmBatchResult> {
  const locale = await getLocale();
  const limited = checkLimit(await clientKey('batch:confirm'), locale);
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: t(locale, 'billing.errors.loginAgain') };
  }

  const ids = [...new Set((jobIds ?? []).filter((id) => typeof id === 'string' && id))];
  if (ids.length === 0) return { error: t(locale, 'billing.errors.nothingSelected') };

  const jobs = await prisma.job.findMany({
    where: { id: { in: ids }, businessId },
    include: {
      customer: { select: { id: true, name: true } },
      invoices: { select: { id: true } },
    },
  });

  const allValid =
    jobs.length === ids.length &&
    jobs.every((j) => j.status === 'COMPLETED' && j.invoices.length === 0);
  if (!allValid) return { error: t(locale, 'billing.errors.someInvalid') };

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true, regionCode: true },
  });
  const taxRate = totalTaxRate(await businessTaxConfig(businessId));
  const invoiceDate = localMidnight(
    todayInTimezone(business?.timezone, business?.regionCode)
  );

  const numbers: string[] = [];
  const createdIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const job of jobs) {
      // Server-side money math — never trusts client values.
      const subtotal = round2(job.price);
      const taxAmount = round2((subtotal * taxRate) / 100);
      const total = round2(subtotal + taxAmount);
      const number = await nextInvoiceNumber(businessId, tx);

      const invoice = await tx.invoice.create({
        data: {
          number,
          date: invoiceDate,
          subtotal,
          taxRate,
          taxAmount,
          total,
          status: 'UNPAID',
          notes: `Batch invoice for job "${job.title}"`,
          customerId: job.customer.id,
          businessId,
          jobId: job.id,
          milestoneLabel: null,
        },
      });
      await tx.invoiceLineItem.create({
        data: {
          invoiceId: invoice.id,
          description: job.title,
          qty: 1,
          unitPrice: round2(job.price),
          position: 0,
        },
      });
      numbers.push(number);
      createdIds.push(invoice.id);
    }

    await tx.automationLog.create({
      data: {
        businessId,
        kind: 'BATCH_INVOICE',
        summary: `Batch-created ${jobs.length} invoice(s): ${numbers.join(', ')}`,
        metaJson: JSON.stringify({
          count: jobs.length,
          invoiceIds: createdIds,
          jobIds: ids,
          invoiceNumbers: numbers,
        }),
      },
    });
  });

  revalidatePath('/invoices');
  revalidatePath('/jobs');
  return { ok: true, created: jobs.length };
}

/**
 * Create ONE milestone/progress invoice against a job. No redirect — the
 * caller routes the user afterwards.
 */
export async function createMilestoneInvoice(
  jobId: string,
  input: { label: string; amount: number | string; description?: string | null }
): Promise<MilestoneResult> {
  const locale = await getLocale();
  const limited = checkLimit(await clientKey('milestone:create'), locale);
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: t(locale, 'billing.errors.loginAgain') };
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId },
    include: { customer: { select: { id: true } } },
  });
  if (!job) return { error: t(locale, 'billing.errors.jobNotFound') };
  if (job.status === 'CANCELLED')
    return { error: t(locale, 'billing.errors.jobCancelled') };

  const validated = validateMilestoneInput(input);
  if (!validated.ok) return { error: t(locale, validated.errorKey) };
  const { label, amount, description } = validated.clean;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true, regionCode: true },
  });
  const taxRate = totalTaxRate(await businessTaxConfig(businessId));

  const subtotal = round2(amount);
  const taxAmount = round2((subtotal * taxRate) / 100);
  const total = round2(subtotal + taxAmount);
  const number = await nextInvoiceNumber(businessId);
  const invoiceDate = localMidnight(
    todayInTimezone(business?.timezone, business?.regionCode)
  );

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        number,
        date: invoiceDate,
        subtotal,
        taxRate,
        taxAmount,
        total,
        status: 'UNPAID',
        notes: `Milestone invoice: ${label}`,
        customerId: job.customer.id,
        businessId,
        jobId: job.id,
        milestoneLabel: label,
      },
    });
    await tx.invoiceLineItem.create({
      data: {
        invoiceId: inv.id,
        description: `${label} — ${description || job.title}`,
        qty: 1,
        unitPrice: subtotal,
        position: 0,
      },
    });
    return inv;
  });

  revalidatePath('/invoices');
  revalidatePath(`/jobs/${job.id}`);
  return { ok: true, invoiceId: invoice.id };
}
