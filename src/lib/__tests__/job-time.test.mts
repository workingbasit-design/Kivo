/**
 * Unit tests for hasJobTime (src/lib/utils.ts).
 * The legacy "TBD" sentinel stored by Copilot must never be treated as a
 * real scheduled time anywhere it is displayed or edited.
 * Run: node --test src/lib/__tests__/job-time.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasJobTime } from '../utils.ts';

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
    // TypeScript narrowing: t is string here — proves the type predicate.
    assert.equal(t.toUpperCase(), '10:00 AM');
  } else {
    assert.fail('should have narrowed');
  }
});
