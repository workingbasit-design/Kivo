/**
 * Pure tax-selection logic for the invoice/quote builders' single tax
 * Select (FIX-NOW Session 2). Kept in the tax lib (no JSX) so unit tests
 * can import it under plain node --test; the TaxSelect component renders it.
 */
import {
  CA_PROVINCES,
  getTaxConfig,
  totalTaxRate,
  type TaxConfig,
} from './tax.ts';
import { t, type Locale } from './i18n/index.ts';

export interface TaxSelection {
  /** Province code, or 'NONE' for no tax. */
  id: string;
  /** Stored taxType for the server (e.g. 'HST', 'GST+QST'). */
  taxType: string;
  /** Stored total rate for the server (e.g. 13, 14.975, 0). */
  taxRate: number;
  /** Display label. */
  label: string;
}

const FR_PROVINCE_NAMES: Record<string, string> = {
  ON: 'Ontario',
  QC: 'Québec',
  BC: 'Colombie-Britannique',
  AB: 'Alberta',
  SK: 'Saskatchewan',
  MB: 'Manitoba',
  NB: 'Nouveau-Brunswick',
  NL: 'Terre-Neuve-et-Labrador',
  NS: 'Nouvelle-Écosse',
  PE: 'Île-du-Prince-Édouard',
  NT: 'Territoires du Nord-Ouest',
  NU: 'Nunavut',
  YT: 'Yukon',
};

/**
 * The real Canadian sales-tax rates, straight from the shared tax engine
 * (./tax.ts) - NS is HST 14% (in force since 2025-04-01), QC is
 * GST 5% + QST 9.975% on the price excluding GST. "No tax" stores as
 * GST 0% so no server change is needed and the stored breakdown stays
 * consistent through splitStoredTax.
 */
export function taxSelections(locale: Locale = 'en'): TaxSelection[] {
  const list: TaxSelection[] = CA_PROVINCES.map((p) => {
    const cfg = getTaxConfig(null, p.code);
    const taxType =
      cfg.taxes.length > 1
        ? `${cfg.taxes[0].name}+${cfg.taxes[1].name}`
        : cfg.taxes[0].name;
    const name =
      locale === 'fr' ? (FR_PROVINCE_NAMES[p.code] ?? p.name) : p.name;
    return {
      id: p.code,
      taxType,
      taxRate: totalTaxRate(cfg),
      label: `${cfg.label} — ${name}`,
    };
  });
  list.push({
    id: 'NONE',
    taxType: 'GST',
    taxRate: 0,
    label: t(locale, 't10money.taxNoTax'),
  });
  return list;
}

/** Default selection: the business's province rate (the service province). */
export function defaultTaxSelection(taxConfig: TaxConfig): TaxSelection {
  const id = (taxConfig.taxRegion ?? 'ON').toUpperCase();
  const found = taxSelections('en').find((s) => s.id === id);
  if (found) return found;
  const cfg = getTaxConfig(null, null);
  return {
    id: 'ON',
    taxType: cfg.taxes[0].name,
    taxRate: totalTaxRate(cfg),
    label: cfg.label,
  };
}
