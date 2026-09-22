/**
 * Kivo tax engine — region-aware sales tax configuration and math.
 *
 * India: single GST slab (configurable 0/5/12/18/28, default 18).
 * Canada: province-based rules (GST / HST / PST / QST combos).
 *
 * NOTE on storage: the Business model has no dedicated "default GST slab"
 * column, so for India businesses the `taxRegion` field carries the GST slab
 * as a string (e.g. "18"). For Canada businesses `taxRegion` carries the
 * province code (e.g. "ON"). This keeps the schema untouched.
 */

export type RegionCode = 'IN' | 'CA';

export interface TaxLine {
  /** e.g. "GST", "HST", "PST", "QST", "CGST", "SGST", "IGST" */
  name: string;
  /** Percent, e.g. 13 or 9.975 */
  rate: number;
}

export interface TaxConfig {
  regionCode: RegionCode;
  /** Province code for CA, GST slab string for IN */
  taxRegion: string | null;
  currency: 'INR' | 'CAD';
  symbol: string;
  taxes: TaxLine[];
  /** Human label, e.g. "HST 13%" or "GST 5% + QST 9.975%" */
  label: string;
}

export interface TaxBreakdownLine extends TaxLine {
  amount: number;
}

export const CA_PROVINCES: { code: string; name: string }[] = [
  { code: 'ON', name: 'Ontario' },
  { code: 'QC', name: 'Quebec' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'AB', name: 'Alberta' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'YT', name: 'Yukon' },
];

/** Allowed GST slabs for India (percent). */
export const IN_GST_SLABS = [0, 5, 12, 18, 28] as const;

export const DEFAULT_IN_GST_SLAB = 18;
export const DEFAULT_CA_PROVINCE = 'ON';

/** Canonical Canadian provincial tax rules. */
const CA_TAXES: Record<string, TaxLine[]> = {
  // HST provinces
  ON: [{ name: 'HST', rate: 13 }],
  NB: [{ name: 'HST', rate: 15 }],
  NL: [{ name: 'HST', rate: 15 }],
  NS: [{ name: 'HST', rate: 15 }],
  PE: [{ name: 'HST', rate: 15 }],
  // GST + provincial tax
  QC: [
    { name: 'GST', rate: 5 },
    { name: 'QST', rate: 9.975 },
  ],
  BC: [
    { name: 'GST', rate: 5 },
    { name: 'PST', rate: 7 },
  ],
  SK: [
    { name: 'GST', rate: 5 },
    { name: 'PST', rate: 6 },
  ],
  MB: [
    { name: 'GST', rate: 5 },
    { name: 'PST', rate: 7 },
  ],
  // GST only
  AB: [{ name: 'GST', rate: 5 }],
  NT: [{ name: 'GST', rate: 5 }],
  NU: [{ name: 'GST', rate: 5 }],
  YT: [{ name: 'GST', rate: 5 }],
};

const round2 = (n: number) => Math.round(n * 100) / 100;
/** 3-decimal rounding — preserves QST's 9.975% through rate sums. */
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Sum of the config's tax rates, e.g. 14.975 for Quebec. */
export function totalTaxRate(config: Pick<TaxConfig, 'taxes'>): number {
  return round3(config.taxes.reduce((s, t) => s + t.rate, 0));
}

/**
 * Build the tax configuration for a business from its region settings.
 * Unknown regions fall back to India defaults (backwards compatible).
 */
export function getTaxConfig(
  regionCode: string | null | undefined,
  taxRegion: string | null | undefined
): TaxConfig {
  const region: RegionCode = regionCode === 'CA' ? 'CA' : 'IN';

  if (region === 'CA') {
    const province = (taxRegion || DEFAULT_CA_PROVINCE).toUpperCase();
    const taxes = CA_TAXES[province] ?? CA_TAXES[DEFAULT_CA_PROVINCE];
    return {
      regionCode: 'CA',
      taxRegion: CA_TAXES[province] ? province : DEFAULT_CA_PROVINCE,
      currency: 'CAD',
      symbol: '$',
      taxes,
      label: taxes.map((t) => `${t.name} ${t.rate}%`).join(' + '),
    };
  }

  // An empty/missing taxRegion means "never configured" -> default slab.
  // (Number('') is 0, which is a valid slab, so check emptiness first.)
  const rawSlab = (taxRegion ?? '').trim();
  const slab = rawSlab === '' ? DEFAULT_IN_GST_SLAB : Number(rawSlab);
  const rate = (IN_GST_SLABS as readonly number[]).includes(slab)
    ? slab
    : DEFAULT_IN_GST_SLAB;
  return {
    regionCode: 'IN',
    taxRegion: String(rate),
    currency: 'INR',
    symbol: '₹',
    taxes: [{ name: 'GST', rate }],
    label: `GST ${rate}%`,
  };
}

/** Convenience: build a TaxConfig straight from a Business row. */
export function taxConfigFromBusiness(b: {
  regionCode: string | null | undefined;
  taxRegion: string | null | undefined;
}): TaxConfig {
  return getTaxConfig(b.regionCode, b.taxRegion);
}

/**
 * Compute tax on a subtotal. Each tax line is applied to the subtotal and
 * rounded to the paisa/cent, then summed — the standard way multi-tax
 * provinces (QC/BC/SK/MB) are quoted on a simple invoice.
 */
export function calcTax(
  subtotal: number,
  config: Pick<TaxConfig, 'taxes'>
): { taxAmount: number; totalRate: number; breakdown: TaxBreakdownLine[] } {
  const breakdown: TaxBreakdownLine[] = config.taxes.map((t) => ({
    ...t,
    amount: round2((subtotal * t.rate) / 100),
  }));
  const taxAmount = round2(breakdown.reduce((s, b) => s + b.amount, 0));
  return { taxAmount, totalRate: totalTaxRate(config), breakdown };
}

/**
 * Default `taxType` value to store on a new invoice for this config.
 * Single-tax regions use the tax name ("HST", "GST"); dual-tax provinces
 * use the composite ("GST+QST", "GST+PST").
 */
export function defaultTaxType(config: Pick<TaxConfig, 'taxes'>): string {
  if (config.taxes.length === 1) return config.taxes[0].name;
  return `${config.taxes[0].name}+${config.taxes[1].name}`;
}

/**
 * Split a stored invoice tax (taxType + total rate) back into its
 * component lines for display. Backwards compatible with the old
 * India-only values (GST/CGST/SGST/IGST).
 *
 * For the Canadian composites the federal GST portion is always 5%, so the
 * provincial portion is derived as (total - 5) — this stays correct even if
 * the rate was hand-edited on the invoice.
 */
export function splitStoredTax(taxType: string, taxRate: number): TaxLine[] {
  const r = round3(taxRate);
  switch (taxType) {
    case 'CGST':
      return [
        { name: 'CGST', rate: round2(r / 2) },
        { name: 'SGST', rate: round2(r / 2) },
      ];
    case 'IGST':
      return [{ name: 'IGST', rate: r }];
    case 'HST':
      return [{ name: 'HST', rate: r }];
    case 'PST':
      return [{ name: 'PST', rate: r }];
    case 'QST':
      return [{ name: 'QST', rate: r }];
    case 'GST+QST':
      return [
        { name: 'GST', rate: 5 },
        { name: 'QST', rate: round3(r - 5) },
      ];
    case 'GST+PST':
      return [
        { name: 'GST', rate: 5 },
        { name: 'PST', rate: round3(r - 5) },
      ];
    default:
      return [{ name: 'GST', rate: r }];
  }
}
