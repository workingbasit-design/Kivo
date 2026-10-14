/**
 * Unit tests for hasJobTime (src/lib/utils.ts).
 * The legacy "TBD" sentinel stored by Copilot must never be treated as a
 * real scheduled time anywhere it is displayed or edited.
 * Run: node --test src/lib/__tests__/job-time.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasJobTime, normalizeJobTime, formatJobTime } from '../utils.ts';

test('real times count as set', () => {
  assert.equal(hasJobTime('10:00 AM'), true);
  assert.equal(hasJobTime('14:30'), true);
  assert.equal(hasJobTime('morning'), true);
});

test('null, undefined and blanks do not count as set', () => {
  assert.equal(hasJobTime(null), false);
  assert.equal(hasJobTime(undefined), false);
  assert.equal(hasJobTime(''), false);
  assert.equal(hasJobTime('   '), false);
});

test('legacy TBD sentinel does not count as set', () => {
  assert.equal(hasJobTime('TBD'), false);
  assert.equal(hasJobTime('tbd'), false);
  assert.equal(hasJobTime(' Tbd '), false);
});

test('narrows to string for display use', () => {
  const t: string | null = '10:00 AM';
  if (hasJobTime(t)) {
    // TypeScript narrowing: t is string here - proves the type predicate.
    assert.equal(t.toUpperCase(), '10:00 AM');
  } else {
    assert.fail('should have narrowed');
  }
});

test('normalizeJobTime: 24h passes through canonically', () => {
  assert.equal(normalizeJobTime('09:00'), '09:00');
  assert.equal(normalizeJobTime('21:30'), '21:30');
  assert.equal(normalizeJobTime('9:00'), '09:00');
});

test('normalizeJobTime: 12h converts to 24h', () => {
  assert.equal(normalizeJobTime('10:00 AM'), '10:00');
  assert.equal(normalizeJobTime('2:00 PM'), '14:00');
  assert.equal(normalizeJobTime('2pm'), '14:00');
  assert.equal(normalizeJobTime('12:00 AM'), '00:00');
  assert.equal(normalizeJobTime('12:00 PM'), '12:00');
});

test('normalizeJobTime: blank/TBD/garbage -> null', () => {
  assert.equal(normalizeJobTime(null), null);
  assert.equal(normalizeJobTime(''), null);
  assert.equal(normalizeJobTime('TBD'), null);
  assert.equal(normalizeJobTime('whenever'), null);
  assert.equal(normalizeJobTime('25:00'), null);
  assert.equal(normalizeJobTime('13:00 PM'), null);
});

test('formatJobTime: en shows 12h, fr shows 24h', () => {
  assert.equal(formatJobTime('09:00', 'en'), '9:00 AM');
  assert.equal(formatJobTime('14:00', 'en'), '2:00 PM');
  assert.equal(formatJobTime('09:00', 'fr'), '9 h 00');
  assert.equal(formatJobTime('14:00', 'fr'), '14 h 00');
});

test('formatJobTime: blank -> empty, legacy text passes through', () => {
  assert.equal(formatJobTime(null, 'en'), '');
  assert.equal(formatJobTime('TBD', 'en'), '');
  assert.equal(formatJobTime('morning', 'en'), 'morning');
});
