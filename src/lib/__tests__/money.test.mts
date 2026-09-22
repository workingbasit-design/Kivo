/**
 * Unit tests for money formatting incl. fr-CA (src/lib/money.ts).
 * Run: node --test src/lib/__tests__/money.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, normalizeCurrency, currencySymbol } from '../money.ts';

test('INR default formatting', () => {
  assert.equal(formatMoney(1499, 'INR'), '₹1,499');
  assert.equal(formatMoney(null, 'INR'), '₹0');
});

test('CAD en-CA formatting', () => {
  assert.equal(formatMoney(149, 'CAD'), '$149.00');
  assert.equal(formatMoney(1234.5, 'CAD'), '$1,234.50');
});

test('CAD fr-CA formatting uses comma decimals and trailing $', () => {
  const s = formatMoney(1234.5, 'CAD', 'fr');
  assert.ok(s.includes(','), `expected comma decimals, got: ${s}`);
  assert.ok(s.trimEnd().endsWith('$'), `expected trailing $, got: ${s}`);
  assert.notEqual(s, formatMoney(1234.5, 'CAD', 'en'));
});

test('currency helpers', () => {
  assert.equal(normalizeCurrency('cad'), 'CAD');
  assert.equal(normalizeCurrency('xyz'), 'INR');
  assert.equal(currencySymbol('CAD'), '$');
  assert.equal(currencySymbol('INR'), '₹');
});
