/**
 * Unit tests for quote money math (src/lib/quote-totals.ts): subtotal →
 * discount → tax → total. DB-free.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeQuoteTotals } from '../quote-totals.ts';

const noDiscount = { type: null as null, value: null };

test('no discount: subtotal + tax = total', () => {
  const r = computeQuoteTotals(
    [
      { qty: 2, unitPrice: 50 },
      { qty: 1, unitPrice: 99.99 },
    ],
    noDiscount,
    [{ name: 'HST', rate: 13 }]
  );
  assert.equal(r.subtotal, 199.99);
  assert.equal(r.discountAmount, 0);
  assert.equal(r.taxable, 199.99);
  assert.equal(r.taxAmount, 26);
  assert.equal(r.total, 225.99);
});

test('PERCENT discount applies before tax', () => {
  const r = computeQuoteTotals(
    [{ qty: 1, unitPrice: 200 }],
    { type: 'PERCENT', value: 10 },
    [{ name: 'GST', rate: 5 }]
  );
  assert.equal(r.subtotal, 200);
  assert.equal(r.discountAmount, 20);
  assert.equal(r.taxable, 180);
  assert.equal(r.taxAmount, 9);
  assert.equal(r.total, 189);
});

test('AMOUNT discount applies before tax', () => {
  const r = computeQuoteTotals(
    [{ qty: 1, unitPrice: 200 }],
    { type: 'AMOUNT', value: 25 },
    [{ name: 'GST', rate: 5 }]
  );
  assert.equal(r.discountAmount, 25);
  assert.equal(r.taxable, 175);
  assert.equal(r.taxAmount, 8.75);
  assert.equal(r.total, 183.75);
});

test('PERCENT clamps to 0–100', () => {
  const over = computeQuoteTotals([{ qty: 1, unitPrice: 100 }], { type: 'PERCENT', value: 150 }, [{ name: 'GST', rate: 5 }]);
  assert.equal(over.discountAmount, 100);
  assert.equal(over.taxable, 0);
  assert.equal(over.total, 0);

  const under = computeQuoteTotals([{ qty: 1, unitPrice: 100 }], { type: 'PERCENT', value: -20 }, [{ name: 'GST', rate: 5 }]);
  assert.equal(under.discountAmount, 0);
  assert.equal(under.total, 105);
});

test('AMOUNT clamps to 0–subtotal', () => {
  const over = computeQuoteTotals([{ qty: 1, unitPrice: 100 }], { type: 'AMOUNT', value: 999 }, [{ name: 'GST', rate: 5 }]);
  assert.equal(over.discountAmount, 100);
  assert.equal(over.total, 0);

  const under = computeQuoteTotals([{ qty: 1, unitPrice: 100 }], { type: 'AMOUNT', value: -5 }, [{ name: 'GST', rate: 5 }]);
  assert.equal(under.discountAmount, 0);
  assert.equal(under.total, 105);
});

test('null value discount is a no-op', () => {
  const r = computeQuoteTotals([{ qty: 1, unitPrice: 100 }], { type: 'PERCENT', value: null }, [{ name: 'GST', rate: 5 }]);
  assert.equal(r.discountAmount, 0);
  assert.equal(r.total, 105);
});

test('empty items → zero totals', () => {
  const r = computeQuoteTotals([], { type: 'PERCENT', value: 50 }, [{ name: 'HST', rate: 13 }]);
  assert.deepEqual(r, { subtotal: 0, discountAmount: 0, taxable: 0, taxAmount: 0, total: 0 });
});

test('tax applies to the discounted amount, not the raw subtotal', () => {
  const r = computeQuoteTotals(
    [{ qty: 3, unitPrice: 33.33 }],
    { type: 'PERCENT', value: 15 },
    [{ name: 'HST', rate: 13 }]
  );
  // subtotal 99.99, 15% → 15.00 discount, taxable 84.99, tax 11.05
  assert.equal(r.subtotal, 99.99);
  assert.equal(r.discountAmount, 15);
  assert.equal(r.taxable, 84.99);
  assert.equal(r.taxAmount, 11.05);
  assert.equal(r.total, 96.04);
});

test('fractional quantities round to 2dp', () => {
  const r = computeQuoteTotals([{ qty: 1.5, unitPrice: 19.99 }], noDiscount, []);
  assert.equal(r.subtotal, 29.99);
  assert.equal(r.total, 29.99);
});

test('Quebec: per-line tax matches calcTax exactly (preview == stored)', () => {
  // The audit's 1c-divergence case: the server used to store
  // round2(subtotal x totalRate/100) = round2(33.35 x 14.975%) = 4.99 while
  // the preview used per-line rounding = 5.00. Both now go through calcTax.
  // (QST applies to the pre-tax subtotal — the post-2013 Revenu Québec rule.)
  const qcTaxes = [
    { name: 'GST', rate: 5 },
    { name: 'QST', rate: 9.975 },
  ];
  const r = computeQuoteTotals([{ qty: 1, unitPrice: 33.35 }], noDiscount, qcTaxes);
  assert.equal(r.taxable, 33.35);
  // GST: 33.35 x 5% = 1.6675 -> 1.67; QST: 33.35 x 9.975% = 3.3266625 -> 3.33
  assert.equal(r.taxAmount, 5.0);
  assert.equal(r.total, 38.35);
});

test('Quebec with discount: tax applies per-line to the discounted amount', () => {
  const qcTaxes = [
    { name: 'GST', rate: 5 },
    { name: 'QST', rate: 9.975 },
  ];
  const r = computeQuoteTotals(
    [{ qty: 1, unitPrice: 100 }],
    { type: 'PERCENT', value: 10 },
    qcTaxes
  );
  assert.equal(r.taxable, 90);
  // GST: 90 x 5% = 4.50; QST: 90 x 9.975% = 8.9775 -> 8.98
  assert.equal(r.taxAmount, 13.48);
  assert.equal(r.total, 103.48);
});
