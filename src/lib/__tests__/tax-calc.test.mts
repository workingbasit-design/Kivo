/**
 * Tax math tests (M3). Pure functions - no database required.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcTaxCents, calcTax, getTaxConfig } from '../tax.ts';

describe('calcTaxCents (integer cents, from TaxRate rows)', () => {
  it('computes each line on the pre-tax subtotal with half-up rounding', () => {
    const { taxCents, breakdown } = calcTaxCents(10000, [
      { taxType: 'HST', rateBps: 13000 },
    ]);
    assert.equal(breakdown[0].amountCents, 1300);
    assert.equal(taxCents, 1300);
  });

  it('QST is computed on the pre-GST base (not GST-inclusive)', () => {
    // Quebec: $100.00 subtotal. QST 9.975% on the PRE-GST price =
    // round(10000 * 9975 / 100000) = round(997.5) = 998c. The obsolete
    // pre-2013 rule (QST on the GST-inclusive $105.00) would give 1047c.
    const { breakdown } = calcTaxCents(10000, [
      { taxType: 'GST', rateBps: 5000 },
      { taxType: 'QST', rateBps: 9975 },
    ]);
    const gst = breakdown.find((b) => b.taxType === 'GST')!;
    const qst = breakdown.find((b) => b.taxType === 'QST')!;
    assert.equal(gst.amountCents, 500);
    assert.equal(qst.amountCents, 998);
    assert.notEqual(qst.amountCents, 1047);
  });

  it('rounds half cents up and never uses floating point', () => {
    // 50c at 13% = 6.5c -> rounds half up to 7c.
    const { taxCents } = calcTaxCents(50, [{ taxType: 'HST', rateBps: 13000 }]);
    assert.equal(taxCents, 7);
    // Sum of lines always equals the total (no drift).
    const r = calcTaxCents(33333, [
      { taxType: 'GST', rateBps: 5000 },
      { taxType: 'PST', rateBps: 7000 },
    ]);
    assert.equal(
      r.taxCents,
      r.breakdown.reduce((s, b) => s + b.amountCents, 0)
    );
  });

  it('agrees with legacy calcTax on whole-dollar amounts', () => {
    const cents = calcTaxCents(25000, [
      { taxType: 'GST', rateBps: 5000 },
      { taxType: 'PST', rateBps: 7000 },
    ]);
    const legacy = calcTax(250, {
      taxes: [
        { name: 'GST', rate: 5 },
        { name: 'PST', rate: 7 },
      ],
    });
    assert.equal(cents.taxCents, Math.round(legacy.taxAmount * 100));
  });
});

describe('tax config (M3 corrections)', () => {
  it('Nova Scotia uses HST 14% (15% until 2025-03-31)', () => {
    const cfg = getTaxConfig('CA', 'NS');
    assert.equal(cfg.taxes.length, 1);
    assert.equal(cfg.taxes[0].name, 'HST');
    assert.equal(cfg.taxes[0].rate, 14);
  });

  it('Quebec still quotes GST 5% + QST 9.975%', () => {
    const cfg = getTaxConfig('CA', 'QC');
    assert.deepEqual(
      cfg.taxes.map((t) => [t.name, t.rate]),
      [
        ['GST', 5],
        ['QST', 9.975],
      ]
    );
  });
});
