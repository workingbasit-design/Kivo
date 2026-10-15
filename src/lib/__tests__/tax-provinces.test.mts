/**
 * P4-U-001 / P4-U-002 — Provincial tax table coverage.
 *
 * Every Canadian province/territory resolves to the correct tax lines via
 * getTaxConfig; QST is computed on the pre-GST base; HST provinces are a
 * single line. (NS 15%→14% date rule is covered in tax-calc.test.mts.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getTaxConfig, calcTaxCents, totalTaxRate } from '../tax.ts';

const EXPECTED: Record<string, Array<[string, number]>> = {
  ON: [['HST', 13]],
  NB: [['HST', 15]],
  NL: [['HST', 15]],
  NS: [['HST', 14]],
  PE: [['HST', 15]],
  QC: [
    ['GST', 5],
    ['QST', 9.975],
  ],
  BC: [
    ['GST', 5],
    ['PST', 7],
  ],
  SK: [
    ['GST', 5],
    ['PST', 6],
  ],
  MB: [
    ['GST', 5],
    ['PST', 7],
  ],
  AB: [['GST', 5]],
  NT: [['GST', 5]],
  NU: [['GST', 5]],
  YT: [['GST', 5]],
};

test('P4-U-001: all 13 provinces/territories resolve to the documented tax lines', () => {
  for (const [code, lines] of Object.entries(EXPECTED)) {
    const cfg = getTaxConfig('CA', code);
    assert.deepEqual(
      cfg.taxes.map((t) => [t.name, t.rate]),
      lines,
      `province ${code}`,
    );
    assert.equal(cfg.currency, 'CAD');
  }
});

test('P4-U-001: unknown province falls back to Ontario HST 13%', () => {
  const cfg = getTaxConfig('CA', 'XX');
  assert.deepEqual(
    cfg.taxes.map((t) => [t.name, t.rate]),
    [['HST', 13]],
  );
  assert.equal(cfg.taxRegion, 'ON');
});

test('P4-U-001: HST provinces are a single tax line (not GST+PST)', () => {
  for (const code of ['ON', 'NB', 'NL', 'NS', 'PE']) {
    const cfg = getTaxConfig('CA', code);
    assert.equal(cfg.taxes.length, 1, code);
    assert.equal(cfg.taxes[0].name, 'HST');
  }
});

test('P4-U-001: Quebec total rate preserves QST thousandths (14.975)', () => {
  const cfg = getTaxConfig('CA', 'QC');
  assert.equal(totalTaxRate(cfg), 14.975);
});

test('P4-U-002: QST is computed on the pre-GST selling price (in force since 2013-01-01)', () => {
  // $100.00 sale in QC: GST = $5.00, QST = 9.975% of $100.00 = $9.98 (NOT of $105).
  const { taxCents, breakdown } = calcTaxCents(10000, [
    { taxType: 'GST', rateBps: 5000 },
    { taxType: 'QST', rateBps: 9975 },
  ]);
  const gst = breakdown.find((b) => b.taxType === 'GST')!;
  const qst = breakdown.find((b) => b.taxType === 'QST')!;
  assert.equal(gst.amountCents, 500);
  assert.equal(qst.amountCents, 998);
  assert.equal(taxCents, 1498);
});

test('P4-U-002: per-line half-cent rounding uses Math.round (no float)', () => {
  // $10.01 in QC: GST 50.05c -> 50c, QST 99.84975c -> 100c.
  const { breakdown } = calcTaxCents(1001, [
    { taxType: 'GST', rateBps: 5000 },
    { taxType: 'QST', rateBps: 9975 },
  ]);
  assert.equal(breakdown[0].amountCents, 50);
  assert.equal(breakdown[1].amountCents, 100);
});
