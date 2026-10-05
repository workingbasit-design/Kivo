/**
 * Regression tests for the 2026-10-04 financial-audit P1:
 * recordPayment never set `paidAt`, silently dropping manual payments
 * from every paidAt-filtered revenue consumer (attention "paid this
 * week", health profitability subscore, scenario revenue90d).
 *
 * Invariant locked here: the invoice update payload stamps paidAt exactly
 * when the new status is PAID, on the manual payment path — and never
 * touches paidAt otherwise (a fully-paid invoice stays fully paid).
 *
 * The helper lives in the pure module src/lib/invoice-paid.ts (a
 * 'use server' action file may only export async functions), so this
 * test imports it directly — no stubs needed.
 *
 * Run: npm test -- src/lib/__tests__/invoice-paid.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);

const { invoicePaidUpdate } = await import('../invoice-paid.ts');

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
