/**
 * Real phone validation/normalization via libphonenumber-js.
 *
 * The business region decides the default country: IN for Indian
 * businesses, CA for Canadian ones (everything else falls back to IN).
 * Empty input is always valid (phone is optional in Kivo).
 */

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export const INVALID_PHONE_MESSAGE = "That phone number doesn't look valid.";

export function countryForRegion(regionCode?: string | null): CountryCode {
  return (regionCode ?? 'IN').toUpperCase() === 'CA' ? 'CA' : 'IN';
}

export interface PhoneCheck {
  ok: boolean;
  /** E.164 digits without the leading "+" (e.g. "919876543210"), null if invalid/empty. */
  digits: string | null;
}

/**
 * Validate a phone number for the business region. Accepts when the number
 * is possible for the region (isPossibleNumber semantics). Returns the
 * E.164 digit form for storage; display should keep the user's formatting.
 */
export function validatePhone(phone: string | null | undefined, regionCode?: string | null): PhoneCheck {
  const trimmed = (phone ?? '').trim();
  if (!trimmed) return { ok: true, digits: null };
  try {
    const parsed = parsePhoneNumberFromString(trimmed, countryForRegion(regionCode));
    if (!parsed || !parsed.isPossible()) return { ok: false, digits: null };
    return { ok: true, digits: parsed.number.replace(/\D/g, '') };
  } catch {
    return { ok: false, digits: null };
  }
}
