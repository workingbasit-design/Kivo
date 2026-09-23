/**
 * Canadian postal code validation and formatting.
 *
 * Canada: A1A 1A1 (letter-digit-letter digit-letter-digit), stored "A1A 1A1".
 * Empty input is always valid (postal code is optional in EveryJob).
 */

export interface PostalCheck {
  ok: boolean;
  /** Canonical formatted value, or null when empty/invalid. */
  formatted: string | null;
}

const CA_RE = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i;

export function validatePostalCode(
  code: string | null | undefined,
  _regionCode?: string | null
): PostalCheck {
  const trimmed = (code ?? '').trim().toUpperCase();
  if (!trimmed) return { ok: true, formatted: null };
  const compact = trimmed.replace(/\s+/g, '');
  if (!CA_RE.test(compact)) return { ok: false, formatted: null };
  return { ok: true, formatted: `${compact.slice(0, 3)} ${compact.slice(3)}` };
}

export const INVALID_POSTAL_MESSAGE = 'Enter a valid postal code (e.g. M5V 2T6).';
