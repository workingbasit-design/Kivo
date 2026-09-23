/**
 * Unit tests for CAD money formatting incl. fr-CA (src/lib/money.ts).
 * Run: node --test src/lib/__tests__/money.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, normalizeCurrency, currencySymbol, currencyLabel } from '../money.ts';

test('CAD en formatting', () => {
  assert.equal(formatMoney(149, 'CAD', 'en'), '$149.00');
  assert.equal(formatMoney(1234.5, 'CAD', 'en'), '$1,234.50');
  assert.equal(formatMoney(null, 'CAD', 'en'), '$0.00');
});

test('CAD fr-CA formatting uses comma decimals and trailing $', () => {
  const s = formatMoney(1234.5, 'CAD', 'fr');
  assert.ok(s.includes(','), `expected comma decimals, got: ${s}`);
  assert.ok(s.trimEnd().endsWith('$'), `expected trailing $, got: ${s}`);
  assert.notEqual(s, formatMoney(1234.5, 'CAD', 'en'));
});

test('currency helpers are always CAD', () => {
  assert.equal(normalizeCurrency('cad'), 'CAD');
  assert.equal(normalizeCurrency('xyz'), 'CAD');
  assert.equal(normalizeCurrency(null), 'CAD');
  assert.equal(currencySymbol('CAD'), '$');
  assert.equal(currencyLabel('CAD'), 'Canadian Dollar (CAD)');
});
