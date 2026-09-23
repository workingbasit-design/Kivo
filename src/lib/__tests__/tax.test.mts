/**
 * Unit tests for the Canadian tax engine (src/lib/tax.ts).
 * Run: node --test src/lib/__tests__/tax.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTaxConfig,
  calcTax,
  totalTaxRate,
  defaultTaxType,
  splitStoredTax,
  taxIdLabelForRegion,
  CA_PROVINCES,
} from '../tax.ts';

test('HST provinces get a single HST line at the right rate', () => {
  for (const [code, rate] of [['ON', 13], ['NB', 15], ['NL', 15], ['NS', 15], ['PE', 15]] as const) {
    const c = getTaxConfig('CA', code);
    assert.equal(c.currency, 'CAD');
    assert.equal(c.regionCode, 'CA');
    assert.deepEqual(c.taxes, [{ name: 'HST', rate }]);
    assert.equal(c.label, `HST ${rate}%`);
  }
});

test('Quebec gets GST 5% + QST 9.975%', () => {
  const c = getTaxConfig('CA', 'QC');
  assert.deepEqual(c.taxes, [
    { name: 'GST', rate: 5 },
    { name: 'QST', rate: 9.975 },
  ]);
  assert.equal(c.label, 'GST 5% + QST 9.975%');
  assert.equal(totalTaxRate(c), 14.975);
});

test('PST provinces get GST 5% + PST', () => {
  const bc = getTaxConfig('CA', 'BC');
  assert.deepEqual(bc.taxes, [
    { name: 'GST', rate: 5 },
    { name: 'PST', rate: 7 },
  ]);
  const sk = getTaxConfig('CA', 'SK');
  assert.equal(sk.taxes[1].rate, 6);
  const mb = getTaxConfig('CA', 'MB');
  assert.equal(mb.taxes[1].rate, 7);
});

test('GST-only provinces (AB + territories)', () => {
  for (const code of ['AB', 'NT', 'NU', 'YT']) {
    const c = getTaxConfig('CA', code);
    assert.deepEqual(c.taxes, [{ name: 'GST', rate: 5 }]);
  }
});

test('unknown province falls back to Ontario HST', () => {
  const c = getTaxConfig('CA', 'ZZ');
  assert.equal(c.taxRegion, 'ON');
  assert.deepEqual(c.taxes, [{ name: 'HST', rate: 13 }]);
});

test('all 13 provinces/territories are listed', () => {
  assert.equal(CA_PROVINCES.length, 13);
});

test('calcTax rounds each line to the cent then sums (QC example)', () => {
  const c = getTaxConfig('CA', 'QC');
  const { taxAmount, breakdown } = calcTax(100, c);
  assert.equal(breakdown[0].amount, 5);
  // 100 * 9.975% = 9.975 -> 9.98
  assert.equal(breakdown[1].amount, 9.98);
  assert.equal(taxAmount, 14.98);
});

test('calcTax on Ontario HST', () => {
  const { taxAmount } = calcTax(200, getTaxConfig('CA', 'ON'));
  assert.equal(taxAmount, 26);
});

test('defaultTaxType: single vs composite', () => {
  assert.equal(defaultTaxType(getTaxConfig('CA', 'ON')), 'HST');
  assert.equal(defaultTaxType(getTaxConfig('CA', 'QC')), 'GST+QST');
  assert.equal(defaultTaxType(getTaxConfig('CA', 'BC')), 'GST+PST');
});

test('splitStoredTax round-trips composites', () => {
  assert.deepEqual(splitStoredTax('GST+QST', 14.975), [
    { name: 'GST', rate: 5 },
    { name: 'QST', rate: 9.975 },
  ]);
  assert.deepEqual(splitStoredTax('GST+PST', 12), [
    { name: 'GST', rate: 5 },
    { name: 'PST', rate: 7 },
  ]);
  assert.deepEqual(splitStoredTax('HST', 13), [{ name: 'HST', rate: 13 }]);
});

test('tax ID label is GST/HST in English, TPS/TVQ in French', () => {
  assert.equal(taxIdLabelForRegion('CA', 'en'), 'GST/HST number');
  assert.equal(taxIdLabelForRegion('CA', 'fr'), 'N° TPS/TVQ');
});
