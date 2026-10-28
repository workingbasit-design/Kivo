/**
 * Slice 2 (2026-10-28): tax follows where the work happens, not where the
 * business is registered. Pure helper — no DB, no I/O — so unit tests can
 * import it under plain node --test.
 *
 * Precedence:
 *   1. The service property's province (when it is a real CA province code).
 *   2. The business's taxRegion (the pre-slice-2 behaviour).
 *   3. 'ON' — the shared DEFAULT_CA_PROVINCE.
 *
 * A property province is stored validated (normalizeProvinceCode turns
 * blank/junk into null), but the resolver validates again anyway: a junk
 * code must never pick a tax regime, it must fall through to the business
 * region. Never defaults a missing property to the business region
 * silently — that IS the fallback, and it is explicit here.
 */
import { CA_PROVINCES, DEFAULT_CA_PROVINCE } from './tax.ts';

function norm(code: string | null | undefined): string {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

function isProvince(code: string): boolean {
  return CA_PROVINCES.some((p) => p.code === code);
}

export function resolveTaxProvince({
  propertyProvince,
  businessTaxRegion,
}: {
  /** Job's service property province (CustomerProperty.province), may be null. */
  propertyProvince?: string | null;
  /** Business.taxRegion, may be null. */
  businessTaxRegion?: string | null;
}): string {
  const prop = norm(propertyProvince);
  if (prop && isProvince(prop)) return prop;
  const biz = norm(businessTaxRegion);
  if (biz && isProvince(biz)) return biz;
  return DEFAULT_CA_PROVINCE;
}
