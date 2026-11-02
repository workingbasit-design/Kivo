/**
 * Regression tests for two 2026-11-02 deep-test finds (tester position).
 *
 * 1. Manual time entries could never save: createManualEntry stored the
 *    Membership id (member.id) into TimeEntry.userId, which references
 *    User.id — the insert violated the FK at runtime, the job page errored
 *    ("Something went wrong") on every Log-time submit, and no entry was
 *    recorded. The clock-in path already used user.id correctly.
 * 2. The customer portal listed VOID invoices: a voided invoice showed as
 *    "$114.98 due" (or "Paid" when its payment was still COMPLETED),
 *    inflating the customer's "Balance due" with cancelled documents.
 * Source-reading tests (same pattern as verify-fixes.test.mts): both fixes
 * live in action/page wiring, not in a unit-testable pure function.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('timesheets: manual entry stores the User id, not the Membership id', () => {
  const src = readFileSync(new URL('../../app/actions/timesheets.ts', import.meta.url), 'utf8');
  const manual = src.slice(src.indexOf('export async function createManualEntry'));
  assert.match(manual, /userId: member\.userId/);
  assert.doesNotMatch(manual, /userId: member\.id\b/);
});

test('timesheets: clock-in path still stores the acting user id', () => {
  const src = readFileSync(new URL('../../app/actions/timesheets.ts', import.meta.url), 'utf8');
  const manualIdx = src.indexOf('export async function createManualEntry');
  const clockIn = src.slice(0, manualIdx);
  assert.match(clockIn, /userId: user\.id/);
});

test('portal: invoice list excludes VOID invoices', () => {
  const src = readFileSync(new URL('../../app/portal/[token]/page.tsx', import.meta.url), 'utf8');
  const invIdx = src.indexOf('prisma.invoice.findMany');
  assert.ok(invIdx > -1, 'portal invoice query exists');
  const query = src.slice(invIdx, invIdx + 1200);
  assert.match(query, /status: \{ not: 'VOID' \}/);
});
