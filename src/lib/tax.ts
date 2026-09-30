/**
 * EveryJob tax engine — Canadian sales tax configuration and math.
 *
 * Canada-only: province-based rules (GST / HST / PST / QST combos).
 * The Business `taxRegion` field carries the province code (e.g. "ON").
 */

export type RegionCode = 'CA';

export interface TaxLine {
  /** e.g. "GST", "HST", "PST", "QST" */
  name: string;
  /** Percent, e.g. 13 or 9.975 */
  rate: number;
}

export interface TaxConfig {
  regionCode: RegionCode;
  /** Province code, e.g. "ON" */
  taxRegion: string | null;
  currency: 'CAD';
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
 * Build the tax configuration for a business from its province setting.
 * Unknown provinces fall back to Ontario (HST 13%).
 */
export function getTaxConfig(
  _regionCode: string | null | undefined,
  taxRegion: string | null | undefined
): TaxConfig {
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

/** Convenience: build a TaxConfig straight from a Business row. */
export function taxConfigFromBusiness(b: {
  regionCode: string | null | undefined;
  taxRegion: string | null | undefined;
}): TaxConfig {
  return getTaxConfig(b.regionCode, b.taxRegion);
}

/**
 * Compute tax on a subtotal. Each tax line is applied to the subtotal and
 * rounded to the cent, then summed — the standard way multi-tax
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
 * Tax ID label for documents: "GST/HST number" ("N° TPS/TVQ" in French).
 */
export function taxIdLabelForRegion(
  _regionCode: string | null | undefined,
  locale: 'en' | 'fr' = 'en'
): string {
  return locale === 'fr' ? 'N° TPS/TVQ' : 'GST/HST number';
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
 * component lines for display.
 *
 * For the Canadian composites the federal GST portion is always 5%, so the
 * provincial portion is derived as (total - 5) — this stays correct even if
 * the rate was hand-edited on the invoice.
 */
export function splitStoredTax(taxType: string, taxRate: number): TaxLine[] {
  const r = round3(taxRate);
  switch (taxType) {
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
