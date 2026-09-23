/**
 * Unit tests for Canadian postal code validation (src/lib/postal.ts).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePostalCode, INVALID_POSTAL_MESSAGE } from '../postal.ts';

test('CA: valid postal codes normalize to A1A 1A1', () => {
  assert.deepEqual(validatePostalCode('m5v2t6', 'CA'), { ok: true, formatted: 'M5V 2T6' });
  assert.deepEqual(validatePostalCode('M5V 2T6', 'CA'), { ok: true, formatted: 'M5V 2T6' });
  assert.deepEqual(validatePostalCode('  k1a0b1  ', 'CA'), { ok: true, formatted: 'K1A 0B1' });
});

test('CA: invalid postal codes rejected', () => {
  assert.equal(validatePostalCode('12345', 'CA').ok, false);
  assert.equal(validatePostalCode('M5V 2T', 'CA').ok, false);
  assert.equal(validatePostalCode('ABCDEF', 'CA').ok, false);
  assert.equal(validatePostalCode('400053', 'CA').ok, false);
});

test('empty is always valid (optional field)', () => {
  assert.deepEqual(validatePostalCode('', 'CA'), { ok: true, formatted: null });
  assert.deepEqual(validatePostalCode(null, 'CA'), { ok: true, formatted: null });
});

test('error message is the Canadian one', () => {
  assert.ok(INVALID_POSTAL_MESSAGE.includes('M5V 2T6'));
});
