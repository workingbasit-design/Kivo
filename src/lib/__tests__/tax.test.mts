/**
 * Unit tests for the Canadian/Indian tax engine (src/lib/tax.ts).
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
  CA_PROVINCES,
  IN_GST_SLABS,
} from '../tax.ts';

test('HST provinces get a single HST line at the right rate', () => {
  for (const [code, rate] of [['ON', 13], ['NB', 15], ['NL', 15], ['NS', 15], ['PE', 15]] as const) {
    const c = getTaxConfig('CA', code);
    assert.equal(c.currency, 'CAD');
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

test('India: GST slab from taxRegion, invalid slab falls back to 18', () => {
  assert.deepEqual(getTaxConfig('IN', '12').taxes, [{ name: 'GST', rate: 12 }]);
  assert.deepEqual(getTaxConfig('IN', '').taxes, [{ name: 'GST', rate: 18 }]);
  assert.deepEqual(getTaxConfig('IN', '99').taxes, [{ name: 'GST', rate: 18 }]);
  assert.deepEqual(getTaxConfig('IN', null).taxes, [{ name: 'GST', rate: 18 }]);
  for (const s of IN_GST_SLABS) {
    assert.deepEqual(getTaxConfig('IN', String(s)).taxes, [{ name: 'GST', rate: s }]);
  }
});

test('unknown region falls back to India defaults', () => {
  const c = getTaxConfig('XX', null);
  assert.equal(c.regionCode, 'IN');
  assert.equal(c.currency, 'INR');
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
  assert.equal(defaultTaxType(getTaxConfig('IN', '18')), 'GST');
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
  assert.deepEqual(splitStoredTax('CGST', 18), [
    { name: 'CGST', rate: 9 },
    { name: 'SGST', rate: 9 },
  ]);
  assert.deepEqual(splitStoredTax('IGST', 18), [{ name: 'IGST', rate: 18 }]);
});
