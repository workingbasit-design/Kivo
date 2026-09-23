/**
 * Unit tests for checklist-template bundle fields (src/lib/template-bundle.ts):
 * optional price/duration/notes parsing and template-to-job field mapping.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTemplateBundleFields,
  templateToJobInitial,
} from '../template-bundle.ts';

test('parseTemplateBundleFields: blank inputs yield all null', () => {
  const r = parseTemplateBundleFields({ price: '', durationMin: '', notes: '' });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.data, { price: null, durationMin: null, notes: null });
});

test('parseTemplateBundleFields: parses valid price, duration, notes', () => {
  const r = parseTemplateBundleFields({ price: '299', durationMin: '90', notes: ' Bring filters ' });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.data.price, 299);
    assert.equal(r.data.durationMin, 90);
    assert.equal(r.data.notes, 'Bring filters');
  }
});

test('parseTemplateBundleFields: rejects negative price (EN + FR errors)', () => {
  const r = parseTemplateBundleFields({ price: '-5' });
  assert.ok(!r.ok);
  if (!r.ok) {
    assert.match(r.errorEn, /0 or more/);
    assert.match(r.errorFr, /0 ou plus/);
  }
});

test('parseTemplateBundleFields: rejects non-numeric price', () => {
  const r = parseTemplateBundleFields({ price: 'abc' });
  assert.ok(!r.ok);
});

test('parseTemplateBundleFields: rejects duration below 5 and above 1440', () => {
  for (const raw of ['4', '0', '1441', '2.5', 'abc']) {
    const r = parseTemplateBundleFields({ durationMin: raw });
    assert.ok(!r.ok, `expected failure for duration ${raw}`);
    if (!r.ok) {
      assert.match(r.errorEn, /5 and 1440/);
      assert.match(r.errorFr, /5 et 1440/);
    }
  }
});

test('parseTemplateBundleFields: accepts boundary durations 5 and 1440', () => {
  for (const raw of ['5', '1440']) {
    const r = parseTemplateBundleFields({ durationMin: raw });
    assert.ok(r.ok, `expected success for duration ${raw}`);
    if (r.ok) assert.equal(r.data.durationMin, Number(raw));
  }
});

test('parseTemplateBundleFields: zero price is valid (free service bundle)', () => {
  const r = parseTemplateBundleFields({ price: '0' });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.data.price, 0);
});

test('templateToJobInitial: maps title, price, notes', () => {
  assert.deepEqual(
    templateToJobInitial({ name: 'Furnace tune-up', price: 299, notes: 'Bring filters' }),
    { title: 'Furnace tune-up', price: 299, notes: 'Bring filters' }
  );
});

test('templateToJobInitial: omits null price/notes and blank notes', () => {
  assert.deepEqual(
    templateToJobInitial({ name: 'Tune-up', price: null, notes: null }),
    { title: 'Tune-up' }
  );
  assert.deepEqual(
    templateToJobInitial({ name: 'Tune-up', price: null, notes: '   ' }),
    { title: 'Tune-up' }
  );
});
