/**
 * F6 Price Book — pure helpers (no Prisma import; unit-testable under node --test).
 *
 * Margin is derived (price − cost), never stored. All money in integer cents.
 */

export const PRICEBOOK_KINDS = ['SERVICE', 'PRODUCT'] as const;
export type PriceBookKind = (typeof PRICEBOOK_KINDS)[number];

export const PRICEBOOK_TAX_CATEGORIES = [
  'TAXABLE_GST_HST',
  'TAXABLE_PST',
  'TAXABLE_QST',
  'EXEMPT',
] as const;
export type PriceBookTaxCategory = (typeof PRICEBOOK_TAX_CATEGORIES)[number];

export const PRICEBOOK_UNITS = ['each', 'hour', 'job', 'sqft'] as const;
export type PriceBookUnit = (typeof PRICEBOOK_UNITS)[number];

export interface Margin {
  /** price − cost, in cents (may be negative if cost exceeds price). */
  amountCents: number;
  /** margin as a percentage of price; 0 when price is 0. */
  percent: number;
}

function toNumber(cents: bigint | number): number {
  return typeof cents === 'bigint' ? Number(cents) : cents;
}

/**
 * Margin on a price-book item.
 *
 * Returns null (margin hidden) when cost is unset — never 100% — per spec
 * edge case 5.
 */
export function calcMargin(
  priceCents: bigint | number,
  costCents: bigint | number | null | undefined,
): Margin | null {
  if (costCents === null || costCents === undefined) return null;
  const price = toNumber(priceCents);
  const cost = toNumber(costCents);
  const amount = price - cost;
  const percent = price === 0 ? 0 : (amount / price) * 100;
  return { amountCents: amount, percent };
}

export interface DisplayName {
  /** The name to show. */
  text: string;
  /** True when the French name is missing and English is used as fallback. */
  needsTranslation: boolean;
}

/**
 * Localized item name. When the French name is missing, falls back to the
 * English name and flags the row as needing translation (spec edge case 4).
 */
export function displayName(
  item: { name: string; nameFr: string | null | undefined },
  locale: 'en' | 'fr',
): DisplayName {
  if (locale === 'fr') {
    if (item.nameFr && item.nameFr.trim().length > 0) {
      return { text: item.nameFr, needsTranslation: false };
    }
    return { text: item.name, needsTranslation: true };
  }
  return { text: item.name, needsTranslation: false };
}

/**
 * Localized description with the same fallback rule as displayName.
 */
export function displayDescription(
  item: { description: string | null | undefined; descriptionFr: string | null | undefined },
  locale: 'en' | 'fr',
): string | null {
  if (locale === 'fr' && item.descriptionFr && item.descriptionFr.trim().length > 0) {
    return item.descriptionFr;
  }
  return item.description ?? null;
}
/**
 * Filter a business's tax lines down to the ones a price-book item's tax
 * category actually charges. Pure (no Prisma); pairs with calcTax() from
 * ../tax.ts for F6-002. Canada-only: RST is kept with PST (Manitoba's
 * retail sales tax behaves like PST for price-book purposes).
 */
export function applicableTaxes(
  category: string,
  taxes: { name: string; rate: number }[]
): { name: string; rate: number }[] {
  switch (category) {
    case 'TAXABLE_GST_HST':
      return taxes.filter((t) => t.name === 'GST' || t.name === 'HST');
    case 'TAXABLE_PST':
      return taxes.filter((t) => t.name === 'PST' || t.name === 'RST');
    case 'TAXABLE_QST':
      return taxes.filter((t) => t.name === 'QST');
    case 'EXEMPT':
    default:
      // EXEMPT and any unknown category fail closed: no tax lines.
      return [];
  }
}
