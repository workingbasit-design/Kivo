/**
 * Real phone validation/normalization via libphonenumber-js.
 *
 * EveryJob is Canada-only: the default country is always CA (NANP).
 * Empty input is always valid (phone is optional in EveryJob).
 */

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export const INVALID_PHONE_MESSAGE = "That phone number doesn't look valid.";

/** Canada-only: always CA. Kept as a function for call-site compatibility. */
export function countryForRegion(_regionCode?: string | null): CountryCode {
  return 'CA';
}

export interface PhoneCheck {
  ok: boolean;
  /** E.164 digits without the leading "+" (e.g. "14165550100"), null if invalid/empty. */
  digits: string | null;
}

/**
 * Validate a Canadian (NANP) phone number. Accepts when the number is
 * possible for CA (isPossibleNumber semantics). Returns the E.164 digit
 * form for storage; display should keep the user's formatting.
 */
export function validatePhone(phone: string | null | undefined, _regionCode?: string | null): PhoneCheck {
  const trimmed = (phone ?? '').trim();
  if (!trimmed) return { ok: true, digits: null };
  try {
    const parsed = parsePhoneNumberFromString(trimmed, 'CA');
    if (!parsed || !parsed.isPossible()) return { ok: false, digits: null };
    return { ok: true, digits: parsed.number.replace(/\D/g, '') };
  } catch {
    return { ok: false, digits: null };
  }
}
