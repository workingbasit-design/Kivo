/**
 * Regression tests for the 2026-10-26 deep-test expense failures:
 * - deleteExpense returned { ok:false, error:'deleteFailed' } because it
 *   called prisma.jobExpense.delete() with `where: { id }` and no
 *   businessId; the tenant guard fails closed on unscoped writes.
 * - updateExpense had the same unscoped `where: { id }` on update().
 * - DeleteExpenseButton / ExpenseForm render top-level `errors.*` toast
 *   keys that did not exist in either locale, so t() returned the raw
 *   dotted key in the UI.
 *
 * These tests stub prisma/auth and run the REAL guard assertion inside the
 * stubbed writes - a regression throws TenantScopeError here, as in prod.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/expense-tenant-scope.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./expense-stub-loader.mjs', import.meta.url);

const { updateExpense, deleteExpense } = await import('@/app/actions/expenses.ts');
const stub = await import('./expense-stub.mjs');
const { t } = await import('@/lib/i18n/index.ts');

function expenseForm() {
  const fd = new FormData();
  fd.set('description', 'Copper pipe');
  fd.set('amount', '42.50');
  fd.set('category', 'MATERIALS');
  fd.set('spentAt', '2026-10-26');
  return fd;
}

test('deleteExpense scopes the delete by businessId (no TenantScopeError)', async () => {
  stub.resetExpenseStub();
  const res = await deleteExpense('exp_1');
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(stub.deleteCalls.length, 1);
  assert.equal(stub.deleteCalls[0].where.businessId, 'biz_1');
  assert.equal(stub.deleteCalls[0].where.id, 'exp_1');
});

test('deleteExpense unknown id returns notFound without deleting', async () => {
  stub.resetExpenseStub();
  const res = await deleteExpense('exp_missing');
  assert.deepEqual(res, { ok: false, error: 'notFound' });
  assert.equal(stub.deleteCalls.length, 0);
});

test('updateExpense scopes the update by businessId (no TenantScopeError)', async () => {
  stub.resetExpenseStub();
  const res = await updateExpense('exp_1', expenseForm());
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(stub.updateCalls.length, 1);
  assert.equal(stub.updateCalls[0].where.businessId, 'biz_1');
  assert.equal(stub.updateCalls[0].where.id, 'exp_1');
  assert.equal(stub.updateCalls[0].data.description, 'Copper pipe');
  assert.equal(stub.updateCalls[0].data.category, 'MATERIALS');
});

test('top-level errors.* toast keys resolve in both locales', () => {
  assert.equal(t('en', 'errors.somethingWentWrong'), 'Something went wrong. Please try again.');
  assert.equal(t('fr', 'errors.somethingWentWrong'), 'Une erreur est survenue. Veuillez réessayer.');
  assert.equal(t('en', 'errors.tooManyRequests'), 'Too many requests. Please wait a moment and try again.');
  assert.equal(t('fr', 'errors.tooManyRequests'), 'Trop de requêtes. Veuillez patienter un moment et réessayer.');
  assert.equal(t('en', 'errors.notFound'), 'That record could not be found.');
  assert.equal(t('fr', 'errors.notFound'), 'Cet enregistrement est introuvable.');
  assert.equal(t('en', 'errors.uploadFailed'), 'Upload failed. Please try again.');
  assert.equal(t('fr', 'errors.uploadFailed'), 'Le téléversement a échoué. Veuillez réessayer.');
});
