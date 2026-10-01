/**
 * Revenue-recovery helpers: overdue-invoice and quote-follow-up logic.
 * Pure functions so they can be unit-tested; the Money hub and Quotes pages
 * call these for their queries and message templates.
 */
import { toISODateInTimezone, defaultTimezoneForRegion } from './utils.ts';

/** Fill {placeholders} in an i18n message template. */
export function fillTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

export const DAY_MS = 86_400_000;

/** Phase 1 has no explicit invoice dueDate — Net-30 from the invoice date. */
export const OVERDUE_AFTER_DAYS = 30;

/** "YYYY-MM-DD" of a Date in UTC (the stored invoice date is UTC-midnight). */
function toISODateUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

/** Add whole days to a "YYYY-MM-DD" key, returning a new key. */
function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return toISODateUTC(dt);
}

/** Whole-day difference between two "YYYY-MM-DD" keys (b - a). */
function diffKeys(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS
  );
}

/**
 * Whole days an invoice is overdue under Net-30. Returns 0 when not yet
 * overdue (never negative, so UIs don't show "-3 days").
 *
 * Day boundaries are calendar days in the business's timezone (not 24-hour
 * blocks from the invoice timestamp): the badge flips at local midnight
 * after the due date, and DST's 23/25-hour days can't shift it. The stored
 * invoice date is UTC-midnight of the calendar date the user picked, so its
 * UTC calendar date is treated as the business-local invoice date.
 */
export function daysOverdue(
  invoiceDate: Date,
  now = new Date(),
  timeZone?: string | null
): number {
  const tz = timeZone || defaultTimezoneForRegion();
  const dueKey = addDaysToKey(toISODateUTC(invoiceDate), OVERDUE_AFTER_DAYS);
  const nowKey = toISODateInTimezone(now, tz);
  return Math.max(0, diffKeys(dueKey, nowKey));
}

/** Quote has no sentAt in Phase 1 — updatedAt is the best "sent" proxy. */
export const FOLLOWUP_AFTER_DAYS = 3;

/** True when a SENT quote has waited long enough to need a follow-up. */
export function needsFollowUp(updatedAt: Date, now = new Date()): boolean {
  return now.getTime() - updatedAt.getTime() >= FOLLOWUP_AFTER_DAYS * DAY_MS;
}

/** Whole days a quote has been waiting (since updatedAt). */
export function daysWaiting(updatedAt: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - updatedAt.getTime()) / DAY_MS));
}

/** Invoice remaining balance, clamped at 0 (overpayments are rejected server-side). */
export function remainingBalance(total: number, payments: number[]): number {
  const paid = payments.reduce((s, p) => s + p, 0);
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}
