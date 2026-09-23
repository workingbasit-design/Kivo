/**
 * Quote add-on helpers (pure — unit-testable without a database).
 *
 * Add-ons are optional extras the client toggles on the public quote page.
 * The stored quote total is the base total; the displayed total is
 * base + selected add-on prices.
 */

export interface QuoteAddonInput {
  price: number;
  selected: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Live client total: base quote total + prices of the selected add-ons.
 * Unselected add-ons never affect the total.
 */
export function addonQuoteTotal(
  baseTotal: number,
  addons: QuoteAddonInput[]
): number {
  const extra = addons
    .filter((a) => a.selected)
    .reduce((sum, a) => sum + a.price, 0);
  return round2(baseTotal + extra);
}
