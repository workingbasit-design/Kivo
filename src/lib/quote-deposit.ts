/**
 * Quote deposit amount parsing — pure, testable.
 *
 * The deposit is optional: blank input means "no deposit requested" (stored
 * as null). When present it must be a positive CAD amount rounded to cents
 * and must not exceed the quote total (server-computed).
 */

/** Parse an optional deposit amount against the server-computed quote total. */
export function parseDepositAmount(
  raw: string | null | undefined,
  total: number
): { amount: number | null; error?: string } {
  const s = (raw ?? '').trim();
  if (!s) return { amount: null };
  const amount = Math.round(Number(s) * 100) / 100;
  // $0 is treated as "no deposit requested" (same as blank).
  if (amount === 0) return { amount: null };
  if (!Number.isFinite(amount) || amount < 0) {
    return { amount: null, error: 'Deposit must be a positive amount.' };
  }
  if (amount > total) {
    return { amount: null, error: 'Deposit cannot exceed the quote total.' };
  }
  return { amount };
}
