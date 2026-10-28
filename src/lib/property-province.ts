/**
 * Service-property province codes (teardown slice 1).
 *
 * A property's province is the tax jurisdiction for work performed
 * there — a Gatineau contractor working in Ottawa charges Ontario
 * HST, not Quebec GST+QST. The code list is shared with the tax
 * module so the two can never drift apart.
 */
import { CA_PROVINCES } from './tax.ts';

const PROVINCE_CODES = new Set(CA_PROVINCES.map((p) => p.code));

/**
 * Normalize a raw province input to a 2-letter CA code, or null.
 * Empty/blank input means "unknown" (null), not an error — the caller
 * decides whether a missing province is acceptable. Anything that is
 * not a real province code is rejected (null) rather than defaulted:
 * silently falling back to Ontario would mis-tax the job.
 */
export function normalizeProvinceCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const code = input.trim().toUpperCase();
  if (code === '') return null;
  return PROVINCE_CODES.has(code) ? code : null;
}

/** True when the raw input is blank or a real province code. */
export function isValidProvinceInput(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  const code = input.trim();
  if (code === '') return true;
  return PROVINCE_CODES.has(code.toUpperCase());
}
