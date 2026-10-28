/**
 * Slice 8 — scheduled invoice generation for recurring jobs (server).
 *
 * Two triggers, one shared shape (DRAFT invoice, pro reviews and sends;
 * never auto-sent, never auto-charged):
 * - PER_VISIT: generatePerVisitInvoice(), called best-effort when a visit
 *   job completes. One line (the visit), tax follows the visit's service
 *   property province (slice 2 rule) falling back to the business region.
 * - MONTHLY: generateMonthlyInvoices(), called by the recurring cron and
 *   by the manual "Generate scheduled invoices" action. One invoice per
 *   series per previous month, one line per completed visit, tax on the
 *   subtotal at the business region (series visits carry no property).
 *
 * Idempotency (never double-bill) without a DB unique — a unique on this
 * populated table would trip the db-push data-loss gate:
 * - PER_VISIT: the generation transaction locks the visit job row first
 *   (updatedAt bump), then checks for an invoice with the
 *   (businessId, recurringJobId, schedulePeriod = visit jobId) key.
 * - MONTHLY: the transaction locks the series row first, re-reads
 *   lastInvoicePeriod (the marker), checks for an invoice with the
 *   (businessId, recurringJobId, schedulePeriod = "YYYY-MM") key, and
 *   only then inserts + sets the marker. A second concurrent run blocks
 *   on the row lock, then sees the first run's marker/invoice and skips.
 *   The marker is only set together with an invoice, so a run that finds
 *   no billable visits leaves the period retryable.
 * - Deleting a generated DRAFT frees nothing: the monthly marker still
 *   says the period was handled, so it will not regenerate (the pro
 *   deleted it deliberately; manual invoicing remains available).
 *
 * Tenant guard: every query on tenant models carries where.businessId
 * (slice 7 lesson — unscoped update/delete throws TenantScopeError).
 * Nothing here throws: failures return { error } so a completion or a
 * cron run never fails because generation did.
 */
import { prisma } from './prisma.ts';
import { dollarsToCents, centsToDollars } from './money.ts';
import { getTaxConfig, totalTaxRate, calcTax } from './tax.ts';
import { resolveTaxProvince } from './property-tax.ts';
import { nextDocumentNumber } from './numbering.ts';
import {
  todayInTimezone,
  toISODateInTimezone,
  parseDateInputInTimezone,
  defaultTimezoneForRegion,
} from './utils.ts';
import {
  previousMonthKey,
  nextMonthKey,
  isMonthlyGenerationDay,
  selectMonthlyVisits,
} from './invoice-schedules.ts';
import { logger } from './logger.ts';

const round2 = (n: number) => Math.round(n * 100) / 100;

export type ScheduledInvoiceResult = {
  created: number;
  numbers: string[];
  skipped?: boolean;
  error?: string;
};

type BusinessCtx = {
  timezone: string;
  regionCode: string | null;
  taxRegion: string | null;
};

async function businessContext(businessId: string): Promise<BusinessCtx> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true, regionCode: true, taxRegion: true },
  });
  return {
    timezone: b?.timezone || defaultTimezoneForRegion(b?.regionCode),
    regionCode: b?.regionCode ?? null,
    taxRegion: b?.taxRegion ?? null,
  };
}

/** Per-visit: one DRAFT invoice for a completed visit of a PER_VISIT series. */
export async function generatePerVisitInvoice(
  businessId: string,
  jobId: string,
  createdBy: string
): Promise<ScheduledInvoiceResult> {
  try {
    const job = await prisma.job.findFirst({
      where: { id: jobId, businessId },
      select: {
        id: true,
        title: true,
        date: true,
        status: true,
        skippedAt: true,
        priceCents: true,
        customerId: true,
        recurringJobId: true,
        invoicedAt: true,
        property: { select: { province: true } },
      },
    });
    if (!job || job.status !== 'COMPLETED' || job.skippedAt || !job.recurringJobId) {
      return { created: 0, numbers: [], skipped: true };
    }
    const series = await prisma.recurringJob.findFirst({
      where: { id: job.recurringJobId, businessId },
      select: { id: true, title: true, invoiceSchedule: true, active: true },
    });
    if (!series || !series.active || series.invoiceSchedule !== 'PER_VISIT') {
      return { created: 0, numbers: [], skipped: true };
    }
    const ctx = await businessContext(businessId);
    const period = job.id;
    const number = await prisma.$transaction(async (tx) => {
      // Lock the visit row first, then check the idempotency key.
      await tx.job.update({
        where: { id: job.id, businessId },
        data: { updatedAt: new Date() },
      });
      const existing = await tx.invoice.findFirst({
        where: { businessId, recurringJobId: series.id, schedulePeriod: period },
        select: { id: true },
      });
      if (existing) return null;
      const subtotalCents = job.priceCents;
      const subtotal = centsToDollars(subtotalCents);
      const taxConfig = getTaxConfig(
        ctx.regionCode,
        resolveTaxProvince({
          propertyProvince: job.property?.province,
          businessTaxRegion: ctx.taxRegion,
        })
      );
      const taxRate = totalTaxRate(taxConfig);
      const taxAmount = calcTax(subtotal, taxConfig).taxAmount;
      const total = round2(subtotal + taxAmount);
      const num = await nextDocumentNumber(tx, businessId, 'INVOICE');
      const dateValue = parseDateInputInTimezone(todayInTimezone(ctx.timezone), ctx.timezone);
      const visitKey = toISODateInTimezone(job.date, ctx.timezone);
      const inv = await tx.invoice.create({
        data: {
          number: num,
          date: dateValue,
          dueAt: null, // DRAFT: no due date until sent (M10)
          subtotalCents,
          taxRate,
          taxAmountCents: dollarsToCents(taxAmount) ?? BigInt(0),
          totalCents: dollarsToCents(total) ?? BigInt(0),
          status: 'DRAFT',
          notes: `Scheduled invoice for "${series.title}" — visit ${visitKey}.`,
          customerId: job.customerId,
          businessId,
          jobId: job.id,
          recurringJobId: series.id,
          schedulePeriod: period,
          createdBy,
        },
      });
      await tx.invoiceLineItem.create({
        data: {
          invoiceId: inv.id,
          description: job.title,
          qty: 1,
          unitPriceCents: subtotalCents,
          position: 0,
        },
      });
      if (!job.invoicedAt) {
        await tx.job.update({
          where: { id: job.id, businessId },
          data: { invoicedAt: new Date() },
        });
      }
      await tx.automationLog.create({
        data: {
          businessId,
          kind: 'SCHEDULED_INVOICE',
          summary: `Scheduled per-visit invoice ${num} for "${series.title}".`,
          metaJson: JSON.stringify({
            seriesId: series.id,
            period,
            invoiceId: inv.id,
            invoiceNumber: num,
            jobId: job.id,
          }),
        },
      });
      return num;
    });
    if (!number) return { created: 0, numbers: [], skipped: true };
    return { created: 1, numbers: [number] };
  } catch (e) {
    logger.error('scheduled-invoices: per-visit generation failed', {
      businessId,
      jobId,
      error: e,
    });
    return { created: 0, numbers: [], error: 'Generation failed.' };
  }
}

/** Monthly: one DRAFT invoice per due series for the previous month. */
export async function generateMonthlyInvoices(
  businessId: string,
  now: Date,
  createdBy: string
): Promise<ScheduledInvoiceResult> {
  try {
    const ctx = await businessContext(businessId);
    const todayKey = todayInTimezone(ctx.timezone, null, now);
    const todayDay = Number(todayKey.slice(8, 10));
    const period = previousMonthKey(todayKey.slice(0, 7));
    const seriesList = await prisma.recurringJob.findMany({
      where: { businessId, active: true, invoiceSchedule: 'MONTHLY' },
      select: {
        id: true,
        title: true,
        customerId: true,
        invoiceDayOfMonth: true,
        lastInvoicePeriod: true,
      },
    });
    const numbers: string[] = [];
    for (const series of seriesList) {
      if (!isMonthlyGenerationDay(series.invoiceDayOfMonth, todayDay)) continue;
      if (series.lastInvoicePeriod === period) continue;
      const num = await generateMonthlyForSeries(
        businessId,
        series,
        period,
        todayKey,
        ctx,
        createdBy
      );
      if (num) numbers.push(num);
    }
    return { created: numbers.length, numbers };
  } catch (e) {
    logger.error('scheduled-invoices: monthly generation failed', {
      businessId,
      error: e,
    });
    return { created: 0, numbers: [], error: 'Generation failed.' };
  }
}

async function generateMonthlyForSeries(
  businessId: string,
  series: {
    id: string;
    title: string;
    customerId: string;
    invoiceDayOfMonth: number | null;
  },
  period: string,
  todayKey: string,
  ctx: BusinessCtx,
  createdBy: string
): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    // Lock the series row first, then re-read the marker: a concurrent
    // run blocks here, then sees the first run's marker/invoice and skips.
    await tx.recurringJob.update({
      where: { id: series.id, businessId },
      data: { updatedAt: new Date() },
    });
    const fresh = await tx.recurringJob.findFirst({
      where: { id: series.id, businessId },
      select: { lastInvoicePeriod: true },
    });
    if (fresh?.lastInvoicePeriod === period) return null;
    const existing = await tx.invoice.findFirst({
      where: { businessId, recurringJobId: series.id, schedulePeriod: period },
      select: { id: true },
    });
    if (existing) return null;

    const monthStart = parseDateInputInTimezone(`${period}-01`, ctx.timezone);
    const monthEnd = parseDateInputInTimezone(`${nextMonthKey(period)}-01`, ctx.timezone);
    const visits = await tx.job.findMany({
      where: {
        businessId,
        recurringJobId: series.id,
        date: { gte: monthStart, lt: monthEnd },
      },
      select: {
        id: true,
        title: true,
        date: true,
        status: true,
        skippedAt: true,
        priceCents: true,
      },
    });
    const linked = await tx.invoice.findMany({
      where: {
        businessId,
        jobId: { in: visits.map((v) => v.id) },
        status: { not: 'VOID' },
      },
      select: { jobId: true },
    });
    const invoiced = new Set(
      linked.map((l) => l.jobId).filter((j): j is string => j != null)
    );
    const billable = selectMonthlyVisits(
      visits.map((v) => ({
        id: v.id,
        status: v.status,
        skippedAt: v.skippedAt,
        dateKey: toISODateInTimezone(v.date, ctx.timezone),
      })),
      period,
      invoiced
    );
    if (billable.length === 0) return null;

    const byId = new Map(visits.map((v) => [v.id, v]));
    const subtotalCents = billable.reduce(
      (s, v) => s + (byId.get(v.id)?.priceCents ?? BigInt(0)),
      BigInt(0)
    );
    const subtotal = centsToDollars(subtotalCents);
    const taxConfig = getTaxConfig(
      ctx.regionCode,
      resolveTaxProvince({ propertyProvince: null, businessTaxRegion: ctx.taxRegion })
    );
    const taxRate = totalTaxRate(taxConfig);
    const taxAmount = calcTax(subtotal, taxConfig).taxAmount;
    const total = round2(subtotal + taxAmount);
    const num = await nextDocumentNumber(tx, businessId, 'INVOICE');
    const dateValue = parseDateInputInTimezone(todayKey, ctx.timezone);
    const inv = await tx.invoice.create({
      data: {
        number: num,
        date: dateValue,
        dueAt: null, // DRAFT: no due date until sent (M10)
        subtotalCents,
        taxRate,
        taxAmountCents: dollarsToCents(taxAmount) ?? BigInt(0),
        totalCents: dollarsToCents(total) ?? BigInt(0),
        status: 'DRAFT',
        notes: `Scheduled monthly invoice for "${series.title}" — ${period}.`,
        customerId: series.customerId,
        businessId,
        recurringJobId: series.id,
        schedulePeriod: period,
        createdBy,
      },
    });
    await tx.invoiceLineItem.createMany({
      data: billable.map((v, idx) => ({
        invoiceId: inv.id,
        description: `${byId.get(v.id)?.title ?? 'Visit'} — ${v.dateKey}`,
        qty: 1,
        unitPriceCents: byId.get(v.id)?.priceCents ?? BigInt(0),
        position: idx,
      })),
    });
    // Mark only visits not already stamped (a voided manual invoice may
    // have stamped one without billing it).
    await tx.job.updateMany({
      where: {
        id: { in: billable.map((v) => v.id) },
        businessId,
        invoicedAt: null,
      },
      data: { invoicedAt: new Date() },
    });
    await tx.recurringJob.update({
      where: { id: series.id, businessId },
      data: { lastInvoicePeriod: period },
    });
    await tx.automationLog.create({
      data: {
        businessId,
        kind: 'SCHEDULED_INVOICE',
        summary: `Scheduled monthly invoice ${num} for "${series.title}" (${period}, ${billable.length} visits).`,
        metaJson: JSON.stringify({
          seriesId: series.id,
          period,
          invoiceId: inv.id,
          invoiceNumber: num,
          jobIds: billable.map((v) => v.id),
        }),
      },
    });
    return num;
  });
}
