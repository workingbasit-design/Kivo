/**
 * Unit tests for the quote deposit amount parser:
 * - src/lib/quote-deposit.ts — parseDepositAmount(raw, total)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDepositAmount } from '../quote-deposit.ts';

test('parseDepositAmount: blank input means no deposit (null)', () => {
  assert.deepEqual(parseDepositAmount('', 500), { amount: null });
  assert.deepEqual(parseDepositAmount('   ', 500), { amount: null });
  assert.deepEqual(parseDepositAmount(null, 500), { amount: null });
  assert.deepEqual(parseDepositAmount(undefined, 500), { amount: null });
});

test('parseDepositAmount: accepts a valid positive amount', () => {
  assert.deepEqual(parseDepositAmount('100', 500), { amount: 100 });
  assert.deepEqual(parseDepositAmount(' 250.50 ', 500), { amount: 250.5 });
});

test('parseDepositAmount: rounds to cents', () => {
  assert.deepEqual(parseDepositAmount('99.999', 500), { amount: 100 });
});

test('parseDepositAmount: rejects zero, negative, and non-numeric input', () => {
  assert.equal(parseDepositAmount('0', 500).error, 'Deposit must be a positive amount.');
  assert.equal(parseDepositAmount('-50', 500).error, 'Deposit must be a positive amount.');
  assert.equal(parseDepositAmount('abc', 500).error, 'Deposit must be a positive amount.');
});

test('parseDepositAmount: rejects amounts above the quote total', () => {
  assert.equal(
    parseDepositAmount('600', 500).error,
    'Deposit cannot exceed the quote total.'
  );
});

test('parseDepositAmount: amount equal to the total is allowed', () => {
  assert.deepEqual(parseDepositAmount('500', 500), { amount: 500 });
});
