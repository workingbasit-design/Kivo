import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProvinceCode, isValidProvinceInput } from '../property-province.ts';

test('normalizeProvinceCode: uppercases and accepts real codes', () => {
  assert.equal(normalizeProvinceCode('on'), 'ON');
  assert.equal(normalizeProvinceCode(' QC '), 'QC');
  assert.equal(normalizeProvinceCode('BC'), 'BC');
  assert.equal(normalizeProvinceCode('YT'), 'YT');
});

test('normalizeProvinceCode: blank means unknown, never a default', () => {
  assert.equal(normalizeProvinceCode(''), null);
  assert.equal(normalizeProvinceCode('   '), null);
  assert.equal(normalizeProvinceCode(null), null);
  assert.equal(normalizeProvinceCode(undefined), null);
});

test('normalizeProvinceCode: rejects non-provinces instead of mis-taxing', () => {
  assert.equal(normalizeProvinceCode('XX'), null);
  assert.equal(normalizeProvinceCode('ONT'), null);
  assert.equal(normalizeProvinceCode('CA'), null);
  assert.equal(normalizeProvinceCode(123), null);
});

test('isValidProvinceInput: blank ok, real code ok, junk not ok', () => {
  assert.equal(isValidProvinceInput(''), true);
  assert.equal(isValidProvinceInput('mb'), true);
  assert.equal(isValidProvinceInput('ZZ'), false);
});
