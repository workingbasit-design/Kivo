/**
 * Quote money math (pure, DB-free): subtotal → discount → tax → total.
 *
 * Discount rules:
 * - PERCENT: clamped to 0-100% of the subtotal
 * - AMOUNT: clamped to 0-subtotal
 * - null type (or null value): no discount
 * Tax is applied to the discounted taxable amount, never to the raw subtotal.
 *
 * Tax is computed per line via calcTax (the same function the quote form
 * preview uses), so the stored total always equals the previewed total.
 */
import { calcTax, totalTaxRate, type TaxLine, type TaxBreakdownLine } from './tax.ts';

export type DiscountType = 'PERCENT' | 'AMOUNT' | null;

export interface QuoteTotals {
  subtotal: number;
  discountAmount: number;
  taxable: number;
  taxAmount: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface QuoteDisplayTax {
  /** Effective total tax rate (0 when the business is not registered). */
  rate: number;
  /** Tax portion backed out of the stored total (0 when not registered). */
  taxAmount: number;
  /** Pre-tax portion of the stored total. */
  taxable: number;
  /** Per-line breakdown; empty when the business is not registered. */
  taxLines: TaxBreakdownLine[];
}

/**
 * Tax lines for DISPLAYING a stored quote total (pro detail page, sign
 * page, public quote page). The stored total is tax-inclusive ONLY when
 * the business is GST/HST registered — createQuote applies the M2 rule
 * (an unregistered business quotes no tax, whatever the form posts).
 * An unregistered business therefore shows NO tax lines: the old code
 * backed phantom tax out of the total from region settings alone, so a
 * $150 ON quote from an unregistered business displayed a fictional
 * "HST 13% $17.26" line (2026-11-13 deep test). When registered, the
 * back-out matches the stored total exactly, with the multi-tax
 * rounding-drift fix so the lines sum to taxAmount.
 */
export function quoteDisplayTax(
  totalDollars: number,
  taxes: TaxLine[],
  registered: boolean
): QuoteDisplayTax {
  if (!registered) {
    return { rate: 0, taxAmount: 0, taxable: round2(totalDollars), taxLines: [] };
  }
  const rate = totalTaxRate({ taxes });
  const taxAmount =
    rate > 0 ? round2((totalDollars * rate) / (100 + rate)) : 0;
  const taxable = round2(totalDollars - taxAmount);
  const taxLines: TaxBreakdownLine[] = taxes.map((t) => ({
    ...t,
    amount:
      taxes.length === 1
        ? taxAmount
        : round2((taxable * t.rate) / 100),
  }));
  // Fix rounding drift on multi-tax configs so lines sum to taxAmount.
  if (taxLines.length > 1) {
    const sum = round2(taxLines.reduce((s, l) => s + l.amount, 0));
    taxLines[taxLines.length - 1].amount = round2(
      taxLines[taxLines.length - 1].amount + (taxAmount - sum)
    );
  }
  return { rate, taxAmount, taxable, taxLines };
}

export function computeQuoteTotals(
  items: { qty: number; unitPrice: number }[],
  discount: { type: DiscountType; value: number | null },
  taxes: TaxLine[]
): QuoteTotals {
  const subtotal = round2(
    items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  );

  let discountAmount = 0;
  const rawValue = discount.value ?? 0;
  if (discount.type === 'PERCENT' && Number.isFinite(rawValue)) {
    const pct = Math.min(100, Math.max(0, rawValue));
    discountAmount = round2((subtotal * pct) / 100);
  } else if (discount.type === 'AMOUNT' && Number.isFinite(rawValue)) {
    discountAmount = round2(Math.min(subtotal, Math.max(0, rawValue)));
  }

  const taxable = round2(subtotal - discountAmount);
  // Per-line tax via the shared tax engine - identical to the form preview.
  const { taxAmount } = calcTax(taxable, { taxes });
  const total = round2(taxable + taxAmount);

  return { subtotal, discountAmount, taxable, taxAmount, total };
}
