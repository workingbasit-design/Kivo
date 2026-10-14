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
export function invoicePaidUpdate(newStatus: string): { status: string; paidAt?: Date } {
  return newStatus === 'PAID'
    ? { status: newStatus, paidAt: new Date() }
    : { status: newStatus };
}

/**
 * Due date for a newly issued invoice: issue date + 30 days (net-30).
 * M10 added Invoice.dueAt (nullable; null for drafts). Set at creation for
 * non-draft invoices and when a draft is sent.
 */
export function invoiceDueAt(fromDate: Date): Date {
  return new Date(fromDate.getTime() + 30 * 24 * 60 * 60 * 1000);
}
