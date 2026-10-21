/**
 * D4 regression tests (2026-10-21): an invoice created from a job's
 * "Create invoice" button must link back to the job.
 *
 * The bug: the button opened a blank /invoices/new (no job context) and
 * createInvoice never read or persisted a jobId, so the job kept
 * showing "No invoices linked to this job yet" and stayed invoicable.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs \
 *   src/lib/__tests__/invoice-job-link.test.mts
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./invoice-job-link-stub-loader.mjs', import.meta.url);

const { createInvoice } = await import('@/app/actions/invoices.ts');
const stub = await import('./invoice-job-link-stub.mjs');

function form(jobId?: string, customerId = 'cus_1'): FormData {
  const fd = new FormData();
  fd.set('customerId', customerId);
  fd.set('date', '2026-10-21');
  fd.set('notes', '');
  fd.set(
    'itemsJson',
    JSON.stringify([{ desc: 'Furnace Tuneup', qty: 1, rate: 200 }]),
  );
  if (jobId) fd.set('jobId', jobId);
  return fd;
}

beforeEach(() => stub.resetInvoiceLinkStub());

test('jobId from the job page: the invoice persists the job link', async () => {
  await createInvoice({}, form('job_1'));
  assert.equal(stub.calls.invoiceCreate.length, 1);
  assert.equal(stub.calls.invoiceCreate[0].jobId, 'job_1');
  assert.equal(stub.calls.invoiceCreate[0].customerId, 'cus_1');
  assert.equal(stub.calls.invoiceCreate[0].businessId, 'biz_1');
});

test('first linked invoice stamps the job invoicedAt (A1 bookkeeping)', async () => {
  await createInvoice({}, form('job_1'));
  assert.equal(stub.calls.jobUpdate.length, 1);
  assert.equal(stub.calls.jobUpdate[0].where.id, 'job_1');
  assert.ok(stub.calls.jobUpdate[0].data.invoicedAt instanceof Date);
});

test('an already-invoiced job links again WITHOUT re-stamping invoicedAt', async () => {
  await createInvoice({}, form('job_3'));
  assert.equal(stub.calls.invoiceCreate[0].jobId, 'job_3');
  assert.equal(stub.calls.jobUpdate.length, 0);
});

test("a job of a DIFFERENT customer is not linked (the pair would corrupt the job's list)", async () => {
  await createInvoice({}, form('job_2', 'cus_1'));
  assert.equal(stub.calls.invoiceCreate.length, 1);
  assert.equal(stub.calls.invoiceCreate[0].jobId, undefined);
  assert.equal(stub.calls.jobUpdate.length, 0);
});

test("another business's job is invisible: no link, no stamp", async () => {
  await createInvoice({}, form('job_4'));
  assert.equal(stub.calls.invoiceCreate[0].jobId, undefined);
  assert.equal(stub.calls.jobUpdate.length, 0);
});

test('no jobId (plain invoice flow): unchanged behaviour, no link', async () => {
  await createInvoice({}, form(undefined));
  assert.equal(stub.calls.invoiceCreate.length, 1);
  assert.equal(stub.calls.invoiceCreate[0].jobId, undefined);
  assert.equal(stub.calls.jobUpdate.length, 0);
});
