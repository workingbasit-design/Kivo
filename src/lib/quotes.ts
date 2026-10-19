/**
 * Quote add-on helpers (pure - unit-testable without a database).
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

/**
 * What a converted job should look like when an APPROVED quote becomes a
 * job: the price is the PRE-TAX base (subtotal after discount + selected
 * add-ons), because every invoicing path treats job.price as the subtotal
 * and adds tax on top. Passing a tax-inclusive total here double-taxes the
 * client on the invoice. The notes keep the client-approved tax-inclusive
 * total so the agreed amount is never lost.
 */
/**
 * Canonical notes marker stamped on every job created from a quote.
 * Quote numbers are unique per business (@@unique([businessId, number])),
 * so `Converted from quote <number>.` uniquely identifies the job that
 * came from a given quote. Used both to stamp the job (below) and as the
 * duplicate-conversion guard in convertQuoteToJob — a converted quote
 * keeps its APPROVED status, so without this check "Convert to job" would
 * create a second job (2026-10-19 morning QA: Q-0001 -> 2 jobs).
 */
export function convertedJobNotesPrefix(quoteNumber: string): string {
  return `Converted from quote ${quoteNumber}.`;
}

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
  return { price, notes: `${convertedJobNotesPrefix(quoteNumber)}${suffix}${agreed}` };
}
