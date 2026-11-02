/**
 * Regression test for the 2026-11-02 deep-test find: a no-charge job could
 * never be created from /jobs/new. The price input carried a static
 * `required`, so native browser validation blocked the submit before the
 * server action ran — even with "No charge" ticked. The server already
 * accepts an empty price with noCharge (z.coerce.number() turns "" into 0
 * and the action only rejects price 0 WITHOUT the opt-in), so the fix is
 * to make the attribute conditional: required={!noCharge}.
 * Source-reading test (same pattern as verify-fixes.test.mts): the
 * attribute lives in JSX, not in a unit-testable function.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../components/JobForm.tsx', import.meta.url), 'utf8');

test('job form: price input required is conditional on noCharge', () => {
  const priceIdx = src.indexOf('name="price"');
  assert.ok(priceIdx > -1, 'price input exists in JobForm');
  const block = src.slice(priceIdx, priceIdx + 600);
  assert.match(block, /required=\{!noCharge\}/);
});

test('job form: price input has no static bare required attribute', () => {
  const priceIdx = src.indexOf('name="price"');
  const block = src.slice(priceIdx, priceIdx + 600);
  // A bare `required` line (attribute with no value) would reintroduce the bug.
  assert.doesNotMatch(block, /^\s*required\s*$/m);
});

test('job action still rejects zero price without the no-charge opt-in', () => {
  const actions = readFileSync(new URL('../../app/actions/jobs.ts', import.meta.url), 'utf8');
  assert.match(actions, /parsed\.data\.price === 0 && !noCharge/);
});
