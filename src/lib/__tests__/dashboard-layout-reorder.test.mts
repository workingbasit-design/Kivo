/**
 * FIX-NOW S2 (reorder arrows): functional test of the real reorder path.
 *
 * Exercises exactly what the UI does, end to end:
 *   1. The client handler logic — moveSectionPref / toggleSectionPref, the
 *      same pure functions CustomizePanel calls on arrow/toggle taps.
 *   2. The REAL saveDashboardLayout server action (validation, de-dupe,
 *      upsert, revalidatePath) against a stubbed prisma client.
 *   3. A "reload" — the REAL getDashboardLayout read path — asserting the
 *      persisted order matches what the user chose.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs \
 *      src/lib/__tests__/dashboard-layout-reorder.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./dashboard-layout-reorder-loader.mjs', import.meta.url);

const layout = await import('../dashboard-layout.ts');
const { saveDashboardLayout } = await import('@/app/actions/dashboard-layout.ts');
const stub = await import('./dashboard-layout-reorder-stub.mjs');

const { DASHBOARD_SECTIONS, defaultLayoutForRole, moveSectionPref, toggleSectionPref, getDashboardLayout } = layout;

const DEFAULT_KEYS = [...DASHBOARD_SECTIONS];

function freshPrefs() {
  return defaultLayoutForRole('OWNER');
}

function toPayload(prefs) {
  return prefs.map(({ key, visible }) => ({ key, visible }));
}

async function reloadOrder(userId, businessId) {
  const reloaded = await getDashboardLayout(userId, businessId, 'OWNER');
  return reloaded;
}

test('moveSectionPref swaps adjacent entries (unit)', () => {
  const prefs = freshPrefs();
  const next = moveSectionPref(prefs, 1, 1); // move needsYou down
  assert.deepEqual(
    next.map((p) => p.key),
    ['collected', 'keyNumbers', 'needsYou', 'visits', 'pipeline', 'last8Weeks']
  );
  // original untouched
  assert.deepEqual(prefs.map((p) => p.key), DEFAULT_KEYS);
  // move back up restores
  const back = moveSectionPref(next, 2, -1);
  assert.deepEqual(back.map((p) => p.key), DEFAULT_KEYS);
});

test('moveSectionPref is a no-op at the ends (unit)', () => {
  const prefs = freshPrefs();
  assert.strictEqual(moveSectionPref(prefs, 0, -1), prefs);
  assert.strictEqual(moveSectionPref(prefs, prefs.length - 1, 1), prefs);
  assert.strictEqual(moveSectionPref(prefs, -1, 1), prefs);
  assert.strictEqual(moveSectionPref(prefs, 99, 1), prefs);
});

test('toggleSectionPref flips visibility (unit)', () => {
  const prefs = freshPrefs();
  const next = toggleSectionPref(prefs, 0);
  assert.equal(next[0].visible, false);
  assert.ok(next.slice(1).every((p) => p.visible));
  assert.strictEqual(toggleSectionPref(prefs, -1), prefs);
  assert.strictEqual(toggleSectionPref(prefs, 99), prefs);
});

test('functional: arrow move persists and survives a reload', async () => {
  stub.resetReorderStub();
  stub.setTestMember({ id: 'u1' }, 'b1');

  // "Page load": no saved row → role defaults in canonical order.
  const prefs = await getDashboardLayout('u1', 'b1', 'OWNER');
  assert.deepEqual(prefs.map((p) => p.key), DEFAULT_KEYS);

  // User taps "move down" on needsYou (index 1) — the exact client call.
  const moved = moveSectionPref(prefs, 1, 1);
  assert.notStrictEqual(moved, prefs);
  const save = await saveDashboardLayout(toPayload(moved));
  assert.equal(save.ok, true);

  // The page must re-render with the new order (revalidate fired).
  assert.ok(stub.revalidatedPaths.includes('/dashboard'));

  // "Reload": the persisted order matches the arrow move.
  const reloaded = await reloadOrder('u1', 'b1');
  assert.deepEqual(
    reloaded.map((p) => p.key),
    ['collected', 'keyNumbers', 'needsYou', 'visits', 'pipeline', 'last8Weeks']
  );

  // A second move (visits up) stacks on top of the first.
  const moved2 = moveSectionPref(reloaded, 3, -1);
  const save2 = await saveDashboardLayout(toPayload(moved2));
  assert.equal(save2.ok, true);
  const reloaded2 = await reloadOrder('u1', 'b1');
  assert.deepEqual(
    reloaded2.map((p) => p.key),
    ['collected', 'keyNumbers', 'visits', 'needsYou', 'pipeline', 'last8Weeks']
  );
});

test('functional: toggle off/on persists visibility without changing order', async () => {
  stub.resetReorderStub();
  stub.setTestMember({ id: 'u2' }, 'b2');

  // Move pipeline to the top first, so the order is non-default.
  let prefs = await getDashboardLayout('u2', 'b2', 'OWNER');
  prefs = moveSectionPref(prefs, 4, -1);
  prefs = moveSectionPref(prefs, 3, -1);
  prefs = moveSectionPref(prefs, 2, -1);
  prefs = moveSectionPref(prefs, 1, -1);
  assert.equal(prefs[0].key, 'pipeline');
  assert.equal((await saveDashboardLayout(toPayload(prefs))).ok, true);

  // Toggle the first section off.
  const hidden = toggleSectionPref(prefs, 0);
  assert.equal((await saveDashboardLayout(toPayload(hidden))).ok, true);
  let reloaded = await reloadOrder('u2', 'b2');
  assert.deepEqual(reloaded.map((p) => p.key), prefs.map((p) => p.key));
  assert.equal(reloaded[0].visible, false);
  assert.ok(reloaded.slice(1).every((p) => p.visible));

  // Toggle it back on — order still intact.
  const shown = toggleSectionPref(reloaded, 0);
  assert.equal((await saveDashboardLayout(toPayload(shown))).ok, true);
  reloaded = await reloadOrder('u2', 'b2');
  assert.deepEqual(reloaded.map((p) => p.key), prefs.map((p) => p.key));
  assert.ok(reloaded.every((p) => p.visible));
});

test('functional: layouts are per user, never cross-contaminated', async () => {
  stub.resetReorderStub();
  stub.setTestMember({ id: 'u3' }, 'b3');
  const prefs = toggleSectionPref(freshPrefs(), 0);
  assert.equal((await saveDashboardLayout(toPayload(prefs))).ok, true);

  // A different user on the same business still sees defaults.
  const other = await getDashboardLayout('u9', 'b3', 'OWNER');
  assert.deepEqual(other.map((p) => p.key), DEFAULT_KEYS);
  assert.ok(other.every((p) => p.visible));
});

test('functional: validation rejects unknown keys, de-dupes keeping first', async () => {
  stub.resetReorderStub();
  stub.setTestMember({ id: 'u4' }, 'b4');

  const bad = await saveDashboardLayout([{ key: 'nope', visible: true }]);
  assert.equal(bad.ok, false);

  const empty = await saveDashboardLayout([]);
  assert.equal(empty.ok, false);

  // Duplicate keys: first occurrence wins, order of first occurrences kept.
  const dupes = [
    { key: 'visits', visible: true },
    { key: 'collected', visible: true },
    { key: 'visits', visible: false },
  ];
  assert.equal((await saveDashboardLayout(dupes)).ok, true);
  const reloaded = await reloadOrder('u4', 'b4');
  const visits = reloaded.filter((p) => p.key === 'visits');
  assert.equal(visits.length, 1);
  assert.equal(visits[0].visible, true);
  assert.deepEqual(reloaded.map((p) => p.key).slice(0, 2), ['visits', 'collected']);
});
