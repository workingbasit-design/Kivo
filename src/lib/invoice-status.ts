/**
 * Canonical invoice status derivation.
 *
 * Invoice payment status is DERIVED from money, never set directly: the
 * single source of truth is "how many COMPLETED cents have been paid against
 * the total". `recordPayment` and `voidPayment` use deriveStatusFromPayments
 * after every payment/void; all read paths sum via sumMoneyPayments so a
 * voided payment never counts as received money.
 */
export type InvoicePaymentStatus = 'UNPAID' | 'PARTIALLY PAID' | 'PAID';

/** Derive invoice payment status from total vs paid (both in cents). */
export function deriveInvoiceStatus(
  totalCents: bigint,
  paidCents: bigint,
): InvoicePaymentStatus {
  if (paidCents >= totalCents) return 'PAID';
  if (paidCents > BigInt(0)) return 'PARTIALLY PAID';
  return 'UNPAID';
}

/**
 * Money truth for invoice payments (2026-10-21):
 * only COMPLETED payments count as received money. VOID (and FAILED /
 * PENDING) payments keep their audit row but must never count toward paid,
 * balance due, collected, or outstanding - the void-payment dialog promises
 * "Totals and reports will exclude it".
 *
 * Matches the existing convention in src/lib/attention.ts,
 * src/lib/health-score.ts, src/lib/job-queries.ts, src/lib/dashboard.ts and
 * the pay/Stripe API routes (payments: { where: { status: 'COMPLETED' } }).
 */
export function countsAsMoney(paymentStatus: string): boolean {
  return paymentStatus === 'COMPLETED';
}

/** Sum of the money-counting payments in a payment list (cents). */
export function sumMoneyPayments(
  payments: { amountCents: bigint; status: string }[],
): bigint {
  let total = BigInt(0);
  for (const p of payments) {
    if (countsAsMoney(p.status)) total += p.amountCents;
  }
  return total;
}

/**
 * Derived invoice payment status from a full payment list (void-aware).
 * `recordPayment` and `voidPayment` both use this after any payment change
 * so the invoice's stored status always reflects real money.
 */
export function deriveStatusFromPayments(
  totalCents: bigint,
  payments: { amountCents: bigint; status: string }[],
): InvoicePaymentStatus {
  return deriveInvoiceStatus(totalCents, sumMoneyPayments(payments));
}
