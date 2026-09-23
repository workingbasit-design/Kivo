/**
 * Unit tests for customer tag normalization (src/lib/tags.ts).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTags, tagsToDb, MAX_TAGS, MAX_TAG_LENGTH } from '../tags.ts';

test('normalizeTags: lowercase, trim, drop empties, dedupe', () => {
  assert.deepEqual(normalizeTags('VIP, vip , Senior,, dog-friendly '), [
    'vip',
    'senior',
    'dog-friendly',
  ]);
});

test('normalizeTags: empty input yields no tags', () => {
  assert.deepEqual(normalizeTags(''), []);
  assert.deepEqual(normalizeTags(null), []);
  assert.deepEqual(normalizeTags(undefined), []);
  assert.deepEqual(normalizeTags(' , , '), []);
});

test('normalizeTags: caps at MAX_TAGS tags', () => {
  const raw = Array.from({ length: MAX_TAGS + 5 }, (_, i) => `tag${i}`).join(',');
  const tags = normalizeTags(raw);
  assert.equal(tags.length, MAX_TAGS);
  assert.equal(tags[0], 'tag0');
  assert.equal(tags[MAX_TAGS - 1], `tag${MAX_TAGS - 1}`);
});

test('normalizeTags: truncates tags longer than MAX_TAG_LENGTH', () => {
  const long = 'x'.repeat(MAX_TAG_LENGTH + 20);
  const tags = normalizeTags(long);
  assert.equal(tags.length, 1);
  assert.equal(tags[0].length, MAX_TAG_LENGTH);
});

test('normalizeTags: truncation-induced duplicates collapse', () => {
  const a = 'y'.repeat(MAX_TAG_LENGTH) + 'aaa';
  const b = 'y'.repeat(MAX_TAG_LENGTH) + 'bbb';
  assert.deepEqual(normalizeTags(`${a},${b}`), ['y'.repeat(MAX_TAG_LENGTH)]);
});

test('tagsToDb: joins with commas, null when empty', () => {
  assert.equal(tagsToDb('VIP, Senior'), 'vip,senior');
  assert.equal(tagsToDb(''), null);
  assert.equal(tagsToDb('   '), null);
  assert.equal(tagsToDb(null), null);
});

test('tagsToDb: round-trips through normalizeTags', () => {
  assert.deepEqual(normalizeTags(tagsToDb('VIP, senior, VIP')), ['vip', 'senior']);
});
