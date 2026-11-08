/**
 * Regression tests (2026-11-08 deep test): GET /api/customers/options must
 * offer only COMPLETED jobs with no linked invoice as "Link to job"
 * candidates — otherwise a standalone invoice for a job's work stays
 * unlinked and batch invoicing bills the same work a second time.
 *
 * The bug: the invoice form had no way to link an invoice to a job, so a
 * pro who invoiced a completed job standalone saw that job reappear in
 * batch invoicing (INV-0002 standalone + INV-0003 batch for the same
 * $100 QC job, both $114.98). The fix adds the picker fed by this
 * endpoint; this test pins the endpoint's filter.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs \
 *   src/lib/__tests__/customer-options-jobs.test.mts
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./customer-options-jobs-stub-loader.mjs', import.meta.url);

const { GET } = await import('@/app/api/customers/options/route.ts');
const stub = await import('./customer-options-jobs-stub.mjs');

beforeEach(() => stub.resetStub());

test('jobs list offers only the completed, uninvoiced job of this business', async () => {
  const res = await GET();
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.data.jobs.map((j) => j.id),
    ['job-1']
  );
});

test('the jobs query scopes by business and excludes already-invoiced jobs', async () => {
  await GET();
  const where = stub.calls.jobFindMany[0];
  assert.equal(where.businessId, 'biz-1');
  assert.equal(where.status, 'COMPLETED');
  assert.ok(where.invoices && 'none' in where.invoices, 'invoices: { none: {} } filter present');
});

test('offered jobs carry no priceCents (BigInt would break JSON)', async () => {
  const res = await GET();
  assert.equal(res.data.jobs.length, 1);
  assert.deepEqual(Object.keys(res.data.jobs[0]).sort(), ['customerId', 'date', 'id', 'title']);
});

test('customers and properties keep their existing shape', async () => {
  const res = await GET();
  assert.equal(res.data.customers.length, 1);
  assert.equal(res.data.customers[0].id, 'cus-1');
  assert.equal(res.data.properties.length, 1);
  assert.equal(res.data.properties[0].id, 'prop-1');
});

test('unauthenticated: 401, no jobs leaked', async () => {
  stub.setSessionOn(false);
  const res = await GET();
  assert.equal(res.status, 401);
});
