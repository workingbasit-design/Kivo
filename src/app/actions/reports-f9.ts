'use server';

import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { requireMembership } from '@/lib/membership';
import { prisma } from '@/lib/prisma';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { getLocale } from '@/lib/i18n/server';
import { parseFlags, isFlagOn, FLAG_REPORTS } from '@/lib/feature-flags';
import { fetchF9Data } from '@/lib/reports-f9-data';
import {
  toCsv,
  centsToCsvDollars,
  AGING_BUCKETS,
  type AgingBucket,
} from '@/lib/reports-f9';

const exportSchema = z.object({
  report: z.enum(['revenue', 'aging', 'profit', 'tax', 'expenses', 'leads']),
  year: z.number().int().min(2000).max(2100).optional(),
});

export type ExportF9Result =
  | { ok: true; csv: string; filename: string }
  | { ok: false; error: string };

const AGING_LABELS: Record<AgingBucket, string> = {
  current: 'Current',
  d1_30: '1-30 days',
  d31_60: '31-60 days',
  d61_90: '61-90 days',
  d90plus: '90+ days',
};

/**
 * Export one F9 report as CSV (tenant-scoped, voided rows excluded).
 * Owner/Admin only; the `reports` feature flag must be on for the business.
 * CSV content is computed from the same data the screen renders (F9-006).
 */
export async function exportF9Csv(
  report: string,
  year?: number,
): Promise<ExportF9Result> {
  const parsed = exportSchema.safeParse({ report, year });
  if (!parsed.success) {
    return { ok: false, error: 'Invalid report or year.' };
  }

  // businessId always comes from the caller's own session, never the client.
  const { businessId } = await requireAuth();
  const { userId } = await requireMembership(businessId, 'OWNER', 'ADMIN');

  const rl = rateLimit(`reports-f9-export:${userId}`, ACTION_LIMIT);
  if (!rl.ok) {
    return { ok: false, error: 'Too many requests. Please wait a moment.' };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { featureFlags: true, timezone: true },
  });
  if (!isFlagOn(parseFlags(business?.featureFlags), FLAG_REPORTS)) {
    return { ok: false, error: 'Reports are not enabled for this business.' };
  }

  const locale = await getLocale();
  const tz = business?.timezone ?? 'America/Toronto';
  const yr = parsed.data.year ?? new Date().getFullYear();
  const data = await fetchF9Data(businessId, yr, tz, locale);

  let headers: string[];
  let rows: (string | number)[][];
  switch (parsed.data.report) {
    case 'revenue':
      headers = ['Month', 'Invoiced (CAD)', 'Collected (CAD)'];
      rows = data.revenue.map((m) => [
        m.key,
        centsToCsvDollars(m.invoicedCents),
        centsToCsvDollars(m.collectedCents),
      ]);
      break;
    case 'aging':
      headers = ['Bucket', 'Outstanding (CAD)', 'Invoices'];
      rows = AGING_BUCKETS.map((b) => [
        AGING_LABELS[b],
        centsToCsvDollars(data.aging.buckets[b].outstandingCents),
        data.aging.buckets[b].count,
      ]);
      break;
    case 'profit':
      headers = ['Job', 'Revenue (CAD)', 'Costs (CAD)', 'Profit (CAD)', 'Margin %'];
      rows = data.profit.map((j) => [
        j.title,
        centsToCsvDollars(j.revenueCents),
        centsToCsvDollars(j.costCents),
        centsToCsvDollars(j.profitCents),
        j.marginPct === null ? '' : j.marginPct,
      ]);
      break;
    case 'tax':
      headers = ['Month', ...data.tax.types.map((t) => `${t} (CAD)`), 'Total (CAD)'];
      rows = data.tax.rows.map((r) => [
        r.key,
        ...data.tax.types.map((t) => centsToCsvDollars(r.byType[t] ?? 0)),
        centsToCsvDollars(r.totalCents),
      ]);
      break;
    case 'expenses':
      headers = ['Category', 'Amount (CAD)', 'Tax paid (CAD)', 'Entries'];
      rows = data.expenses.map((e) => [
        e.category,
        centsToCsvDollars(e.amountCents),
        centsToCsvDollars(e.taxCents),
        e.count,
      ]);
      break;
    case 'leads':
      headers = ['Source', 'Leads', 'Converted', 'Conversion %'];
      rows = data.leads.rows.map((l) => [
        l.source,
        l.total,
        l.converted,
        l.conversionPct,
      ]);
      break;
  }

  return {
    ok: true,
    csv: toCsv(headers, rows),
    filename: `everyjob-${parsed.data.report}-${yr}.csv`,
  };
}
