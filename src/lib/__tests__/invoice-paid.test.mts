/**
 * Regression tests for the 2026-10-04 financial-audit P1:
 * recordPayment never set `paidAt`, silently dropping manual payments
 * from every paidAt-filtered revenue consumer (attention "paid this
 * week", health profitability subscore, scenario revenue90d).
 *
 * Invariant locked here: the invoice update payload stamps paidAt exactly
 * when the new status is PAID, on the manual payment path - and never
 * touches paidAt otherwise (a fully-paid invoice stays fully paid).
 *
 * The helper lives in the pure module src/lib/invoice-paid.ts (a
 * 'use server' action file may only export async functions), so this
 * test imports it directly - no stubs needed.
 *
 * Run: npm test -- src/lib/__tests__/invoice-paid.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);

const { invoicePaidUpdate } = await import('../invoice-paid.ts');
const { invoiceDueAt } = await import('../invoice-paid.ts');

/** Toronto calendar date of an instant (the date the owner sees). */
function torontoDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

test('PAID update stamps paidAt with a real timestamp', () => {
  const before = Date.now();
  const update = invoicePaidUpdate('PAID');
  const after = Date.now();
  assert.equal(update.status, 'PAID');
  assert.ok(update.paidAt instanceof Date, 'paidAt must be a Date');
  assert.ok(
    update.paidAt.getTime() >= before && update.paidAt.getTime() <= after,
    'paidAt must be stamped at payment time'
  );
});

test('PARTIALLY PAID update does not touch paidAt', () => {
  const update = invoicePaidUpdate('PARTIALLY PAID');
  assert.equal(update.status, 'PARTIALLY PAID');
  assert.ok(!('paidAt' in update), 'partial payments must not stamp paidAt');
});

test('UNPAID update does not touch paidAt', () => {
  const update = invoicePaidUpdate('UNPAID');
  assert.equal(update.status, 'UNPAID');
  assert.ok(!('paidAt' in update), 'unpaid status must not stamp paidAt');
});

test('due date across the DST fallback is a calendar +30 days, not +30x24h', () => {
  // Oct 26 2026 00:00 EDT (04:00Z). The old fixed-24h addition landed
  // Nov 25 04:00Z = Nov 24 23:00 EST, rendering "Due Nov 24".
  const due = invoiceDueAt(new Date('2026-10-26T04:00:00Z'), 'America/Toronto');
  assert.equal(torontoDate(due), '2026-11-25');
});

test('due date outside DST windows is unchanged', () => {
  const due = invoiceDueAt(new Date('2026-06-01T04:00:00Z'), 'America/Toronto');
  assert.equal(torontoDate(due), '2026-07-01');
});

test('due date without a timezone keeps the legacy +30x24h addition', () => {
  const from = new Date('2026-10-26T04:00:00Z');
  const due = invoiceDueAt(from);
  assert.equal(due.getTime(), from.getTime() + 30 * 24 * 60 * 60 * 1000);
});
