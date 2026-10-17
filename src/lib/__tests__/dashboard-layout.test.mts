/**
 * Part C (dashboard rebuild): unit tests for the layout role defaults and
 * the saved-row merge.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultLayoutForRole,
  mergeLayout,
  isDashboardSectionKey,
  DASHBOARD_SECTIONS,
} from '../dashboard-layout.ts';

test('owner sees every section', () => {
  const layout = defaultLayoutForRole('OWNER');
  assert.equal(layout.length, DASHBOARD_SECTIONS.length);
  assert.ok(layout.every((s) => s.visible));
});

test('dispatcher hides money sections only', () => {
  const layout = defaultLayoutForRole('DISPATCHER');
  const hidden = layout.filter((s) => !s.visible).map((s) => s.key);
  assert.deepEqual(hidden.sort(), ['collected', 'keyNumbers', 'last8Weeks', 'pipeline']);
  assert.ok(layout.find((s) => s.key === 'visits')?.visible);
  assert.ok(layout.find((s) => s.key === 'needsYou')?.visible);
});

test('mergeLayout keeps saved order, drops unknown keys, adds new sections', () => {
  const merged = mergeLayout(
    [
      { key: 'visits', visible: true },
      { key: 'bogus', visible: true },
      { key: 'collected', visible: false },
    ],
    'OWNER'
  );
  assert.deepEqual(
    merged.map((s) => s.key),
    ['visits', 'collected', 'needsYou', 'keyNumbers', 'pipeline', 'last8Weeks']
  );
  assert.equal(merged.find((s) => s.key === 'collected')?.visible, false);
  assert.equal(merged.find((s) => s.key === 'needsYou')?.visible, true);
});

test('isDashboardSectionKey rejects unknowns', () => {
  assert.equal(isDashboardSectionKey('collected'), true);
  assert.equal(isDashboardSectionKey('nope'), false);
  assert.equal(isDashboardSectionKey(null), false);
});
