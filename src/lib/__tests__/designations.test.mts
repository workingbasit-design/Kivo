/**
 * Validation tests for designation + trade-profile input
 * (src/lib/designations.ts). Rejects bad data before it reaches the DB.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { designationSchema, tradeProfileSchema, DESIGNATION_TYPES } from '../designations.ts';

const valid = {
  type: 'RED_SEAL',
  title: 'Red Seal Endorsement — Plumber',
  issuer: 'Skilled Trades Ontario',
  number: 'R12345',
  issuedAt: '2020-05-01',
  expiresAt: '',
};

test('accepts a complete valid designation', () => {
  const r = designationSchema.safeParse(valid);
  assert.equal(r.success, true);
});

test('rejects unknown designation types', () => {
  const r = designationSchema.safeParse({ ...valid, type: 'FAKE_CERT' });
  assert.equal(r.success, false);
});

test('all eight designation types are accepted', () => {
  for (const t of DESIGNATION_TYPES) {
    assert.equal(designationSchema.safeParse({ ...valid, type: t }).success, true, t);
  }
});

test('rejects short titles and invalid dates', () => {
  assert.equal(designationSchema.safeParse({ ...valid, title: 'x' }).success, false);
  assert.equal(designationSchema.safeParse({ ...valid, issuedAt: 'not-a-date' }).success, false);
});

test('trims and defaults optional fields', () => {
  const r = designationSchema.safeParse({ type: 'LICENSE', title: '  Master Plumber  ' });
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.title, 'Master Plumber');
    assert.equal(r.data.issuer, '');
    assert.equal(r.data.issuedAt, '');
  }
});

test('trade profile accepts known trades and empty (unset)', () => {
  assert.equal(tradeProfileSchema.safeParse({ trade: 'plumbing', yearsInBusiness: 5, specialties: ['Drains'] }).success, true);
  assert.equal(tradeProfileSchema.safeParse({ trade: '', yearsInBusiness: null, specialties: [] }).success, true);
});

test('trade profile rejects unknown trades and absurd years', () => {
  assert.equal(tradeProfileSchema.safeParse({ trade: 'astronaut', specialties: [] }).success, false);
  assert.equal(tradeProfileSchema.safeParse({ trade: 'hvac', yearsInBusiness: 999, specialties: [] }).success, false);
  assert.equal(tradeProfileSchema.safeParse({ trade: 'hvac', yearsInBusiness: -1, specialties: [] }).success, false);
});

test('trade profile caps specialties at 12', () => {
  const many = Array.from({ length: 13 }, (_, i) => `Specialty ${i}`);
  assert.equal(tradeProfileSchema.safeParse({ trade: 'other', specialties: many }).success, false);
});
