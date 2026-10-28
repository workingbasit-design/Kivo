/**
 * Invoice "fully paid" update payload.
 *
 * paidAt is the "fully paid" timestamp consumed by revenue reporting
 * (attention "paid this week", health profitability subscore, scenario
 * revenue90d) - it must be stamped exactly when the invoice becomes PAID,
 * on EVERY payment path (manual recordPayment, settleJobPaidTx, Stripe
 * webhook). Never cleared: a fully-paid invoice stays fully paid.
 *
 * 2026-10-04 regression: recordPayment updated only `status`, silently
 * dropping manual payments from all paidAt-filtered reporting.
 *
 * Lives in lib (not in the 'use server' action module) because server
 * action files may only export async functions.
 */
import { parseDateInputInTimezone, toISODateInTimezone } from './utils.ts';

export function invoicePaidUpdate(newStatus: string): { status: string; paidAt?: Date } {
  return newStatus === 'PAID'
    ? { status: newStatus, paidAt: new Date() }
    : { status: newStatus };
}

/**
 * Due date for a newly issued invoice: issue date + 30 CALENDAR days in
 * the business timezone (net-30).
 *
 * The old implementation added exactly 30×24h, which lands an hour
 * early across a DST fallback and renders a day early (an Oct 26 issue
 * showed "Due Nov 24" instead of Nov 25). Calendar-day addition in the
 * business timezone keeps the due date on the date the owner expects.
 * With no timezone given, the legacy fixed-24h addition is kept.
 */
export function invoiceDueAt(fromDate: Date, timeZone?: string | null): Date {
  if (!timeZone) {
    return new Date(fromDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  const key = toISODateInTimezone(fromDate, timeZone);
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 30));
  const p = (v: number) => String(v).padStart(2, '0');
  const dueKey = `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
  return parseDateInputInTimezone(dueKey, timeZone);
}
