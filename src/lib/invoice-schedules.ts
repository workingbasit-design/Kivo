/**
 * Slice 8 — invoice schedules for recurring jobs (pure helpers).
 *
 * A schedule lives ON the RecurringJob:
 * - NONE: manual invoicing, today's behaviour.
 * - PER_VISIT: a DRAFT invoice when a visit job completes.
 * - MONTHLY: one DRAFT invoice on invoiceDayOfMonth covering the
 *   PREVIOUS month's completed visits (previous month so the data is
 *   complete — visits completed after the run day still bill, next month).
 *
 * Idempotency key for a generated invoice:
 * (businessId, recurringJobId, schedulePeriod) where schedulePeriod is
 * "YYYY-MM" for monthly or the visit jobId for per-visit. Enforcement is
 * the generation transaction (row lock + marker), not a DB unique.
 */

export const INVOICE_SCHEDULES = ['NONE', 'PER_VISIT', 'MONTHLY'] as const;
export type InvoiceSchedule = (typeof INVOICE_SCHEDULES)[number];

/** Day-of-month for MONTHLY: 1–28 only, so every month has the day. */
export function isValidDayOfMonth(v: unknown): v is number {
  return (
    typeof v === 'number' &&
    Number.isInteger(v) &&
    v >= 1 &&
    v <= 28
  );
}

/** Previous month key for a "YYYY-MM" key: 2026-10 → 2026-09, 2026-01 → 2025-12. */
export function previousMonthKey(monthKey: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return monthKey;
  let year = Number(m[1]);
  let month = Number(m[2]) - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Next month key: 2026-12 → 2027-01. */
export function nextMonthKey(monthKey: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return monthKey;
  let year = Number(m[1]);
  let month = Number(m[2]) + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Is today (business-local day-of-month) the series' monthly run day? */
export function isMonthlyGenerationDay(
  invoiceDayOfMonth: number | null | undefined,
  todayDayOfMonth: number
): boolean {
  return (
    invoiceDayOfMonth != null &&
    isValidDayOfMonth(invoiceDayOfMonth) &&
    invoiceDayOfMonth === todayDayOfMonth
  );
}

export type MonthlyVisitCandidate = {
  id: string;
  status: string;
  skippedAt: Date | null;
  /** Business-local date key (YYYY-MM-DD) of the visit. */
  dateKey: string;
};

/**
 * Pure monthly-visit filter (unit-tested): a visit bills iff it is
 * COMPLETED, not skipped, dated inside the period month, and not already
 * invoiced (a non-voided invoice links the visit — manual or scheduled).
 * The Prisma query fetches candidates; this decides inclusion.
 */
export function selectMonthlyVisits(
  visits: MonthlyVisitCandidate[],
  periodKey: string,
  invoicedJobIds: ReadonlySet<string>
): MonthlyVisitCandidate[] {
  return visits.filter(
    (v) =>
      v.status === 'COMPLETED' &&
      v.skippedAt == null &&
      v.dateKey.startsWith(`${periodKey}-`) &&
      !invoicedJobIds.has(v.id)
  );
}
