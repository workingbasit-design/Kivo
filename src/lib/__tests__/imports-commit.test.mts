/**
 * Import-hardening tests for src/app/actions/imports.ts (commitCsvImport).
 *
 * Proves the audit fixes:
 *  1. Imported customers get phoneNorm (the E.164 matching key) like the UI path.
 *  2. The jobs path re-validates server-side: tampered records (negative
 *     price, malformed date) are rejected instead of stored / 500ing.
 *  3. Re-importing a jobs file does not duplicate jobs.
 *  4. Oversized imports are refused with a clear error (row cap).
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/imports-commit.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./imports-stub-loader.mjs', import.meta.url);

const { commitCsvImport } = await import('@/app/actions/imports.ts');
const stub = await import('./imports-stub.mjs');

const jobRec = (over = {}) => ({
  title: 'Kitchen sink repair',
  customerMatch: 'Marie Tremblay',
  date: '2026-10-05',
  time: '09:30',
  price: 150,
  address: null,
  notes: null,
  ...over,
});

test('customer import sets phoneNorm like the UI path', async () => {
  stub.resetDb();
  const res = await commitCsvImport('customers', [
    { name: 'Jean Dupont', phone: '(514) 555-0199', email: null, address: null, notes: null },
  ]);
  assert.equal(res.ok, true, JSON.stringify(res.errors ?? res.error));
  assert.equal(stub.db.createdCustomers.length, 1);
  const created = stub.db.createdCustomers[0];
  assert.equal(created.phoneNorm, '15145550199', `phoneNorm set to E.164 digits, got ${created.phoneNorm}`);
});

test('jobs import rejects tampered records via server-side re-validation', async () => {
  stub.resetDb();
  // Negative price: fails validation instead of being stored.
  const badPrice = await commitCsvImport('jobs', [jobRec({ price: -50 })]);
  assert.equal(badPrice.ok, false, 'negative price rejected');
  assert.ok((badPrice.errors ?? []).length > 0, 'row errors returned');
  assert.equal(stub.db.createdJobs.length, 0, 'nothing stored');

  // Malformed date: clean validation error, not a 500.
  const badDate = await commitCsvImport('jobs', [jobRec({ date: 'not-a-date' })]);
  assert.equal(badDate.ok, false, 'malformed date rejected');
  assert.equal(stub.db.createdJobs.length, 0, 'nothing stored');
});

test('jobs import does not duplicate on re-import', async () => {
  stub.resetDb();
  const first = await commitCsvImport('jobs', [jobRec()]);
  assert.equal(first.ok, true, JSON.stringify(first.errors ?? first.error));
  assert.equal(first.imported, 1);

  const second = await commitCsvImport('jobs', [jobRec()]);
  assert.equal(second.ok, true);
  assert.equal(second.imported, 0, 're-import creates nothing');
  assert.equal(second.skipped, 1, 'duplicate counted as skipped');
  assert.equal(stub.db.createdJobs.length, 1, 'only one job in the store');
});

test('oversized import is refused with a clear error', async () => {
  stub.resetDb();
  const many = Array.from({ length: 2001 }, (_, i) => ({
    name: `Customer ${i}`,
    phone: null,
    email: null,
    address: null,
    notes: null,
  }));
  const res = await commitCsvImport('customers', many);
  assert.equal(res.ok, false, 'over-cap import refused');
  assert.match(res.errors?.[0]?.message ?? '', /2000/i, 'message names the limit');
  assert.equal(stub.db.createdCustomers.length, 0, 'nothing stored');
});
