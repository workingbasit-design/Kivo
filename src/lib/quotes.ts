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

export interface ConvertibleQuoteAddon extends QuoteAddonInput {
  title: string;
}

const round2 = (n: number) => Number(n.toFixed(2));

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

/**
 * What a converted job should look like when an APPROVED quote becomes a
 * job: the price is the PRE-TAX base (subtotal after discount + selected
 * add-ons), because every invoicing path treats job.price as the subtotal
 * and adds tax on top. Passing a tax-inclusive total here double-taxes the
 * client on the invoice. The notes keep the client-approved tax-inclusive
 * total so the agreed amount is never lost.
 */
export function convertedJobDetails(
  quoteNumber: string,
  preTaxBase: number,
  addons: ConvertibleQuoteAddon[],
  taxInclusiveTotal?: number
): { price: number; notes: string } {
  const selected = addons.filter((a) => a.selected);
  const price = addonQuoteTotal(preTaxBase, addons);
  const suffix =
    selected.length > 0
      ? ` Includes add-ons: ${selected
          .map((a) => `${a.title} ($${a.price.toFixed(2)})`)
          .join(', ')}.`
      : '';
  const agreed =
    taxInclusiveTotal != null
      ? ` Client-approved total: $${taxInclusiveTotal.toFixed(2)} (incl. tax).`
      : '';
  return { price, notes: `Converted from quote ${quoteNumber}.${suffix}${agreed}` };
}
