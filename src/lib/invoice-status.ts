/**
 * Canonical invoice status derivation.
 *
 * Invoice payment status is DERIVED from money, never set directly: the
 * single source of truth is "how many cents have been paid against the
 * total". `recordPayment` uses this after every payment/void.
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
