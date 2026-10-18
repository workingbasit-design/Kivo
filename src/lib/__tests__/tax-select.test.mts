/**
 * FIX-NOW Session 2 (Worker C1) — single tax Select for the invoice and
 * quote builders.
 *
 * The old trio (tax-type dropdown + free-typed % field + 0%/13% chips)
 * submitted taxType + taxRate and the server/preview computed through
 * splitStoredTax + calcTax. The new single Select submits the same
 * taxType + taxRate pair per rate option. These tests PROVE the computed
 * tax amounts are unchanged for every rate: for each selection the new
 * control produces, calcTax(splitStoredTax(...)) equals calcTax on the
 * province's canonical config lines, with the exact expected dollar
 * amounts on a $100 subtotal.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { calcTax, getTaxConfig, splitStoredTax } from '../tax.ts';
import {
  taxSelections,
  defaultTaxSelection,
  type TaxSelection,
} from '../tax-select.ts';

const SUBTOTAL = 100;

/** Expected tax dollars on $100 for each selection id. */
const EXPECTED: Record<string, { tax: number; lines: Array<[string, number, number]> }> = {
  ON: { tax: 13, lines: [['HST', 13, 13]] },
  NB: { tax: 15, lines: [['HST', 15, 15]] },
  NL: { tax: 15, lines: [['HST', 15, 15]] },
  NS: { tax: 14, lines: [['HST', 14, 14]] }, // 14% since 2025-04-01, not 15%
  PE: { tax: 15, lines: [['HST', 15, 15]] },
  QC: {
    tax: 14.98,
    lines: [
      ['GST', 5, 5],
      ['QST', 9.975, 9.98], // QST on the price EXCLUDING GST
    ],
  },
  BC: {
    tax: 12,
    lines: [
      ['GST', 5, 5],
      ['PST', 7, 7],
    ],
  },
  SK: {
    tax: 11,
    lines: [
      ['GST', 5, 5],
      ['PST', 6, 6],
    ],
  },
  MB: {
    tax: 12,
    lines: [
      ['GST', 5, 5],
      ['PST', 7, 7],
    ],
  },
  AB: { tax: 5, lines: [['GST', 5, 5]] },
  NT: { tax: 5, lines: [['GST', 5, 5]] },
  NU: { tax: 5, lines: [['GST', 5, 5]] },
  YT: { tax: 5, lines: [['GST', 5, 5]] },
  NONE: { tax: 0, lines: [['GST', 0, 0]] }, // stored as GST 0%
};

function byId(selections: TaxSelection[], id: string): TaxSelection {
  const sel = selections.find((s) => s.id === id);
  assert.ok(sel, `selection ${id} exists`);
  return sel;
}

test('single Select: every rate computes the documented tax on $100', () => {
  const selections = taxSelections('en');
  for (const [id, exp] of Object.entries(EXPECTED)) {
    const sel = byId(selections, id);
    const { taxAmount, breakdown } = calcTax(SUBTOTAL, {
      taxes: splitStoredTax(sel.taxType, sel.taxRate),
    });
    assert.equal(taxAmount, exp.tax, `${id}: total tax`);
    assert.deepEqual(
      breakdown.map((b) => [b.name, b.rate, b.amount]),
      exp.lines,
      `${id}: breakdown lines`
    );
  }
});

test('single Select: amounts match the canonical province config (old behaviour)', () => {
  // The old trio defaulted taxType/taxRate to the province config; the new
  // control must compute identically for the same province.
  const selections = taxSelections('en');
  for (const code of Object.keys(EXPECTED).filter((id) => id !== 'NONE')) {
    const sel = byId(selections, code);
    const cfg = getTaxConfig('CA', code);
    const fromSelection = calcTax(SUBTOTAL, {
      taxes: splitStoredTax(sel.taxType, sel.taxRate),
    });
    const fromConfig = calcTax(SUBTOTAL, cfg);
    assert.deepEqual(
      fromSelection,
      fromConfig,
      `${code}: selection matches canonical config`
    );
  }
});

test('single Select: "No tax" stores as GST 0% and computes $0', () => {
  const sel = byId(taxSelections('en'), 'NONE');
  assert.equal(sel.taxType, 'GST');
  assert.equal(sel.taxRate, 0);
  const { taxAmount, breakdown } = calcTax(SUBTOTAL, {
    taxes: splitStoredTax(sel.taxType, sel.taxRate),
  });
  assert.equal(taxAmount, 0);
  assert.deepEqual(
    breakdown.map((b) => [b.name, b.rate, b.amount]),
    [['GST', 0, 0]]
  );
});

test('single Select: no free-typed percentages - every option is a fixed rate', () => {
  for (const locale of ['en', 'fr'] as const) {
    const selections = taxSelections(locale);
    assert.equal(selections.length, 14, `${locale}: 13 provinces + no-tax`);
    for (const sel of selections) {
      assert.equal(typeof sel.taxRate, 'number');
      assert.ok(Number.isFinite(sel.taxRate));
      assert.ok(sel.taxRate >= 0 && sel.taxRate <= 100);
      assert.ok(typeof sel.label === 'string' && sel.label.length > 0);
    }
    // Labels are localised (FR province names differ).
    const frNames = taxSelections('fr').map((s) => s.label).join('|');
    assert.ok(frNames.includes('Québec'), 'FR labels use French province names');
    assert.ok(
      byId(taxSelections('fr'), 'NONE').label.includes('TPS/TVQ'),
      'FR no-tax label'
    );
  }
});

test('single Select: defaults to the business province rate', () => {
  const onSel = defaultTaxSelection(getTaxConfig('CA', 'ON'));
  assert.equal(onSel.id, 'ON');
  assert.equal(onSel.taxType, 'HST');
  assert.equal(onSel.taxRate, 13);

  const qcSel = defaultTaxSelection(getTaxConfig('CA', 'QC'));
  assert.equal(qcSel.id, 'QC');
  assert.equal(qcSel.taxType, 'GST+QST');
  assert.equal(qcSel.taxRate, 14.975);

  // Unknown province falls back to Ontario.
  const fallback = defaultTaxSelection(getTaxConfig('CA', 'XX'));
  assert.equal(fallback.id, 'ON');
});
