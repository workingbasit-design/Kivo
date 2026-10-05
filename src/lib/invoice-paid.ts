/**
 * Invoice "fully paid" update payload.
 *
 * paidAt is the "fully paid" timestamp consumed by revenue reporting
 * (attention "paid this week", health profitability subscore, scenario
 * revenue90d) — it must be stamped exactly when the invoice becomes PAID,
 * on EVERY payment path (manual recordPayment, settleJobPaidTx, Stripe
 * webhook). Never cleared: a fully-paid invoice stays fully paid.
 *
 * 2026-10-04 regression: recordPayment updated only `status`, silently
 * dropping manual payments from all paidAt-filtered reporting.
 *
 * Lives in lib (not in the 'use server' action module) because server
 * action files may only export async functions.
 */
export function invoicePaidUpdate(newStatus: string): { status: string; paidAt?: Date } {
  return newStatus === 'PAID'
    ? { status: newStatus, paidAt: new Date() }
    : { status: newStatus };
}
