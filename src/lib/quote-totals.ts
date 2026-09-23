/**
 * Quote money math (pure, DB-free): subtotal → discount → tax → total.
 *
 * Discount rules:
 * - PERCENT: clamped to 0–100% of the subtotal
 * - AMOUNT: clamped to 0–subtotal
 * - null type (or null value): no discount
 * Tax is applied to the discounted taxable amount, never to the raw subtotal.
 */

export type DiscountType = 'PERCENT' | 'AMOUNT' | null;

export interface QuoteTotals {
  subtotal: number;
  discountAmount: number;
  taxable: number;
  taxAmount: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeQuoteTotals(
  items: { qty: number; unitPrice: number }[],
  discount: { type: DiscountType; value: number | null },
  taxRatePct: number
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
  const safeRate = Number.isFinite(taxRatePct) && taxRatePct > 0 ? taxRatePct : 0;
  const taxAmount = round2((taxable * safeRate) / 100);
  const total = round2(taxable + taxAmount);

  return { subtotal, discountAmount, taxable, taxAmount, total };
}
