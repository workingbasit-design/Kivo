/**
 * Revenue-recovery helpers: overdue-invoice and quote-follow-up logic.
 * Pure functions so they can be unit-tested; the Money hub and Quotes pages
 * call these for their queries and message templates.
 */

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

/**
 * Whole days an invoice is overdue under Net-30. Returns 0 when not yet
 * overdue (never negative, so UIs don't show "-3 days").
 */
export function daysOverdue(invoiceDate: Date, now = new Date()): number {
  return Math.max(
    0,
    Math.floor((now.getTime() - invoiceDate.getTime()) / DAY_MS) - OVERDUE_AFTER_DAYS
  );
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
  return Math.max(0, Number(((total - paid)).toFixed(2)));
}
