/**
 * Regression test for the 2026-10-18 morning QA CI incident: `validate`
 * failed at `gen-auth-matrix.mjs --check` because the dashboard-rebuild
 * action `saveDashboardLayout` (Part C "Customize this screen") had no
 * reviewed allow/deny entry.
 *
 * Review rationale (against src/app/actions/dashboard-layout.ts):
 *  - requireAuth() demands a session AND an active business Membership
 *    (M9); anonymous visitors and customer-portal (consumer) sessions are
 *    redirected to /login, so they can never invoke it.
 *  - The write is an upsert keyed by (userId, businessId) from the
 *    caller's own session, with zod-validated section keys: a member can
 *    only ever save their own layout inside their own business.
 *  - Any signed-in member role (owner/admin/dispatcher/technician) may
 *    save their own layout; ownerB (another business) is "allow" in the
 *    sense that requireAuth passes for them in their own business context
 *    — the (userId, businessId) key makes cross-business writes impossible.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const MATRIX_PATH = new URL('../../../tests/auth-matrix/matrix.json', import.meta.url);

const EXPECTED: Record<string, string> = {
  anonymous: 'deny',
  consumer: 'deny',
  ownerA: 'allow',
  adminA: 'allow',
  dispatcherA: 'allow',
  technicianA: 'allow',
  ownerB: 'allow',
};

test('auth-matrix: saveDashboardLayout reviewed verdicts (2026-10-18)', () => {
  const matrix = JSON.parse(readFileSync(MATRIX_PATH, 'utf8')) as {
    personas: string[];
    entries: Array<{ type: string; file?: string; function?: string; expected: Record<string, string> }>;
  };
  const entry = matrix.entries.find(
    (e) => e.type === 'action' && e.file === 'dashboard-layout.ts' && e.function === 'saveDashboardLayout',
  );
  assert.ok(entry, 'saveDashboardLayout missing from auth matrix');
  assert.deepEqual(entry.expected, EXPECTED);
});
