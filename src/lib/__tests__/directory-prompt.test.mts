import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendServiceArea,
  isServiceListed,
} from '../directory-prompt.ts';

test('isServiceListed matches case-insensitively and ignores padding', () => {
  assert.equal(isServiceListed(['Furnace Tune-Up'], 'furnace tune-up'), true);
  assert.equal(isServiceListed(['Furnace Tune-Up'], '  Furnace Tune-Up  '), true);
  assert.equal(isServiceListed(['Furnace Tune-Up'], 'Plumbing'), false);
  assert.equal(isServiceListed([], 'Plumbing'), false);
  assert.equal(isServiceListed(['Plumbing'], '   '), false);
});

test('appendServiceArea appends a new service, trimmed', () => {
  assert.deepEqual(appendServiceArea(['Plumbing'], '  Furnace tune-up '), {
    ok: true,
    areas: ['Plumbing', 'Furnace tune-up'],
  });
});

test('appendServiceArea refuses an already-listed service (any case)', () => {
  assert.deepEqual(appendServiceArea(['Furnace Tune-Up'], 'furnace tune-up'), {
    ok: false,
    reason: 'listed',
  });
  assert.deepEqual(appendServiceArea(['Plumbing'], 'plumbing'), {
    ok: false,
    reason: 'listed',
  });
});

test('appendServiceArea refuses a blank service', () => {
  assert.deepEqual(appendServiceArea([], '   '), { ok: false, reason: 'blank' });
});

test('appendServiceArea refuses when the 12-area cap is full', () => {
  const areas = Array.from({ length: 12 }, (_, i) => `Service ${i + 1}`);
  assert.deepEqual(appendServiceArea(areas, 'New service'), {
    ok: false,
    reason: 'full',
  });
});
