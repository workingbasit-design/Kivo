/**
 * F9: Reports — pure computation functions.
 *
 * All money is integer cents (number). BigInt rows from Prisma are converted
 * to Number at the data-fetching boundary (sums stay far below 2^53).
 * No prisma import here: every function is pure and unit-tested under
 * plain `node --test`.
 */

export type AgingBucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90plus';

export const AGING_BUCKETS: AgingBucket[] = [
  'current',
  'd1_30',
  'd31_60',
  'd61_90',
  'd90plus',
];

/** Map days-past-due to a bucket. <= 0 (not yet due) => 'current'. */
export function agingBucketFor(daysPastDue: number): AgingBucket {
  if (daysPastDue <= 0) return 'current';
  if (daysPastDue <= 30) return 'd1_30';
  if (daysPastDue <= 60) return 'd31_60';
  if (daysPastDue <= 90) return 'd61_90';
  return 'd90plus';
}

/**
 * Whole days an invoice is past due, in the business's wall-clock day.
 * Invoices without a due date are treated as due on their invoice date
 * (net-0). Future due dates => 0 (current).
 */
export function daysPastDue(
  dueAt: Date | null,
  invoiceDate: Date,
  now: Date,
): number {
  const ref = dueAt ?? invoiceDate;
  const msPerDay = 24 * 60 * 60 * 1000;
  const startOf = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.max(
    0,
    Math.floor((startOf(now) - startOf(ref)) / msPerDay),
  );
}

/** "YYYY-MM" key for a date in the given IANA timezone. */
export function monthKeyInTz(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}`;
}

/** Short month label ("Jan", "janv.") for a YYYY-MM key. */
export function monthLabel(key: string, locale: 'en' | 'fr'): string {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    month: 'short',
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

// ---------------------------------------------------------------- revenue

export interface RevenueInvoice {
  totalCents: number;
  date: Date;
}

export interface RevenuePayment {
  amountCents: number;
  createdAt: Date;
}

export interface RevenueMonth {
  key: string; // "YYYY-MM"
  label: string;
  invoicedCents: number;
  collectedCents: number;
}

/**
 * Invoiced vs collected per month for a calendar year (business timezone).
 * Invoiced = invoice totals by invoice date (voided excluded upstream).
 * Collected = completed payments by payment date (voided excluded upstream).
 */
export function computeRevenueByMonth(
  invoices: RevenueInvoice[],
  payments: RevenuePayment[],
  year: number,
  tz: string,
  locale: 'en' | 'fr',
): RevenueMonth[] {
  const months: RevenueMonth[] = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    months.push({
      key,
      label: monthLabel(key, locale),
      invoicedCents: 0,
      collectedCents: 0,
    });
  }
  const byKey = new Map(months.map((mo) => [mo.key, mo]));
  for (const inv of invoices) {
    const mo = byKey.get(monthKeyInTz(inv.date, tz));
    if (mo) mo.invoicedCents += inv.totalCents;
  }
  for (const pay of payments) {
    const mo = byKey.get(monthKeyInTz(pay.createdAt, tz));
    if (mo) mo.collectedCents += pay.amountCents;
  }
  return months;
}

// ---------------------------------------------------------------- AR aging

export interface AgingInvoice {
  id: string;
  totalCents: number;
  paidCents: number; // completed, non-voided payments applied
  dueAt: Date | null;
  date: Date;
}

export interface AgingSummary {
  buckets: Record<AgingBucket, { outstandingCents: number; count: number }>;
  totalOutstandingCents: number;
  totalCount: number;
}

/** AR aging over unpaid/partially-paid invoices (voided excluded upstream). */
export function computeAging(
  invoices: AgingInvoice[],
  now: Date,
): AgingSummary {
  const buckets: AgingSummary['buckets'] = {
    current: { outstandingCents: 0, count: 0 },
    d1_30: { outstandingCents: 0, count: 0 },
    d31_60: { outstandingCents: 0, count: 0 },
    d61_90: { outstandingCents: 0, count: 0 },
    d90plus: { outstandingCents: 0, count: 0 },
  };
  let totalOutstandingCents = 0;
  let totalCount = 0;
  for (const inv of invoices) {
    const outstanding = Math.max(0, inv.totalCents - inv.paidCents);
    if (outstanding <= 0) continue;
    const bucket = agingBucketFor(daysPastDue(inv.dueAt, inv.date, now));
    buckets[bucket].outstandingCents += outstanding;
    buckets[bucket].count += 1;
    totalOutstandingCents += outstanding;
    totalCount += 1;
  }
  return { buckets, totalOutstandingCents, totalCount };
}

// ---------------------------------------------------------------- tax

export interface TaxLineInput {
  taxType: string; // GST | HST | PST | RST | QST
  amountCents: number;
  invoiceDate: Date;
}

export interface TaxPeriodRow {
  key: string; // "YYYY-MM"
  label: string;
  byType: Record<string, number>; // taxType -> cents
  totalCents: number;
}

/** Sales tax collected by type per filing month (voided excluded upstream). */
export function computeTaxByType(
  lines: TaxLineInput[],
  year: number,
  tz: string,
  locale: 'en' | 'fr',
): { rows: TaxPeriodRow[]; types: string[]; totals: Record<string, number> } {
  const types = [...new Set(lines.map((l) => l.taxType))].sort();
  const rows: TaxPeriodRow[] = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    const byType: Record<string, number> = {};
    for (const t of types) byType[t] = 0;
    rows.push({ key, label: monthLabel(key, locale), byType, totalCents: 0 });
  }
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const totals: Record<string, number> = {};
  for (const t of types) totals[t] = 0;
  for (const line of lines) {
    const row = byKey.get(monthKeyInTz(line.invoiceDate, tz));
    if (!row) continue;
    row.byType[line.taxType] = (row.byType[line.taxType] ?? 0) + line.amountCents;
    row.totalCents += line.amountCents;
    totals[line.taxType] = (totals[line.taxType] ?? 0) + line.amountCents;
  }
  return { rows, types, totals };
}

// ---------------------------------------------------------------- profitability

export interface JobProfitInput {
  id: string;
  title: string;
  revenueCents: number; // non-voided invoices linked to the job
  costCents: number; // job expenses (materials/travel/other)
}

export interface JobProfit {
  id: string;
  title: string;
  revenueCents: number;
  costCents: number;
  profitCents: number;
  marginPct: number | null; // null when revenue is 0
}

/** Job profitability: revenue - costs, sorted worst-first for attention. */
export function computeJobProfit(jobs: JobProfitInput[]): JobProfit[] {
  return jobs
    .map((j) => ({
      id: j.id,
      title: j.title,
      revenueCents: j.revenueCents,
      costCents: j.costCents,
      profitCents: j.revenueCents - j.costCents,
      marginPct:
        j.revenueCents > 0
          ? Math.round(((j.revenueCents - j.costCents) / j.revenueCents) * 1000) / 10
          : null,
    }))
    .sort((a, b) => a.profitCents - b.profitCents);
}

// ---------------------------------------------------------------- expenses

export interface ExpenseInput {
  category: string;
  amountCents: number;
  taxGstHstCents: number;
  taxQstCents: number;
  taxPstCents: number;
}

export interface ExpenseCategoryRow {
  category: string;
  amountCents: number;
  taxCents: number;
  count: number;
}

export function computeExpensesByCategory(
  expenses: ExpenseInput[],
): ExpenseCategoryRow[] {
  const byCat = new Map<string, ExpenseCategoryRow>();
  for (const e of expenses) {
    const row = byCat.get(e.category) ?? {
      category: e.category,
      amountCents: 0,
      taxCents: 0,
      count: 0,
    };
    row.amountCents += e.amountCents;
    row.taxCents += e.taxGstHstCents + e.taxQstCents + e.taxPstCents;
    row.count += 1;
    byCat.set(e.category, row);
  }
  return [...byCat.values()].sort((a, b) => b.amountCents - a.amountCents);
}

// ---------------------------------------------------------------- leads

export interface LeadInput {
  source: string | null;
  status: string; // NEW | CONTACTED | CONVERTED | EXPIRED
}

export interface LeadSourceRow {
  source: string;
  total: number;
  converted: number;
  conversionPct: number;
}

export const UNKNOWN_SOURCE = '(unknown)';

/** Lead sources with conversion rate (CONVERTED / total). */
export function computeLeadSources(leads: LeadInput[]): {
  rows: LeadSourceRow[];
  total: number;
  converted: number;
  conversionPct: number;
} {
  const bySource = new Map<string, { total: number; converted: number }>();
  for (const lead of leads) {
    const source = lead.source?.trim() || UNKNOWN_SOURCE;
    const row = bySource.get(source) ?? { total: 0, converted: 0 };
    row.total += 1;
    if (lead.status === 'CONVERTED') row.converted += 1;
    bySource.set(source, row);
  }
  const rows: LeadSourceRow[] = [...bySource.entries()]
    .map(([source, r]) => ({
      source,
      total: r.total,
      converted: r.converted,
      conversionPct: r.total > 0 ? Math.round((r.converted / r.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);
  const total = leads.length;
  const converted = leads.filter((l) => l.status === 'CONVERTED').length;
  return {
    rows,
    total,
    converted,
    conversionPct: total > 0 ? Math.round((converted / total) * 1000) / 10 : 0,
  };
}

// ---------------------------------------------------------------- CSV

/** Minimal CSV builder with RFC 4180 quoting. Amounts are dollars (2dp). */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number): string => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

/** Cents -> "1234.56" dollars string for CSV. */
export function centsToCsvDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}
