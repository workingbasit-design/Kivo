/**
 * Pure voiding helpers (morning QA 2026-10-15).
 *
 * Launch-pack item 7: only DRAFT invoices can be hard-deleted; SENT,
 * PARTIALLY_PAID and PAID invoices must be voided with a reason of at
 * least 10 characters (audit trail). The reason-length rule lives here so
 * the server actions and the unit tests share one implementation.
 *
 * 'use server' action files may only export async functions, so this
 * pure module is imported by src/app/actions/invoices.ts and tested
 * directly (no stubs needed).
 */

/** Minimum void-reason length (launch-pack item 7). */
export const VOID_REASON_MIN_LENGTH = 10;

/**
 * A void reason is valid when it has at least 10 non-whitespace-trimmed
 * characters. Non-string input is never valid.
 */
export function isValidVoidReason(reason: unknown): boolean {
  return (
    typeof reason === 'string' && reason.trim().length >= VOID_REASON_MIN_LENGTH
  );
}
