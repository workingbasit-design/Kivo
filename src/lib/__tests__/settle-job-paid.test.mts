/**
 * Regression tests for the 2026-10-01 earnings-math fix: marking a job PAID
 * used to flip only the status, so "Collected" and the monthly revenue bars
 * (payment-based) showed $0.00 while top-customer / avg-job-value /
 * revenue-by-service (job-based) showed the job's price.
 *
 * settleJobPaid() (src/app/actions/invoices.ts) now settles the money in the
 * same transaction: open invoices get a COMPLETED payment for the outstanding
 * balance, and a job with no invoice gets a paid invoice + payment created.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/settle-job-paid.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./settle-stub-loader.mjs', import.meta.url);

const { settleJobPaid } = await import('@/app/actions/invoices.ts');
const stub = await import('./settle-stub.mjs');

test('no invoice + priced job: creates a PAID invoice and a COMPLETED payment', async () => {
  stub.setScenario('no-invoice');
  stub.resetSettleStub();
  await settleJobPaid('biz_1', 'job_1', stub.makeTx());

  assert.equal(stub.calls.invoiceCreate.length, 1);
  const inv = stub.calls.invoiceCreate[0];
  assert.equal(inv.total, 299);
  assert.equal(inv.status, 'PAID');
  assert.equal(inv.businessId, 'biz_1');
  assert.equal(inv.jobId, 'job_1');
  assert.match(inv.number, /^INV-\d+$/);

  assert.equal(stub.calls.lineItemCreate.length, 1);
  assert.equal(stub.calls.lineItemCreate[0].unitPrice, 299);

  assert.equal(stub.calls.paymentCreate.length, 1);
  const pay = stub.calls.paymentCreate[0];
  assert.equal(pay.amount, 299);
  assert.equal(pay.status, 'COMPLETED');
  assert.equal(pay.provider, 'OTHER');
  assert.equal(pay.businessId, 'biz_1');
});

test('open invoice: records payment for the outstanding balance and marks it PAID', async () => {
  stub.setScenario('open-invoice');
  stub.resetSettleStub();
  await settleJobPaid('biz_1', 'job_1', stub.makeTx());

  assert.equal(stub.calls.invoiceCreate.length, 0);
  assert.equal(stub.calls.paymentCreate.length, 1);
  assert.equal(stub.calls.paymentCreate[0].amount, 199); // 299 - 100 already paid
  assert.equal(stub.calls.paymentCreate[0].status, 'COMPLETED');

  assert.equal(stub.calls.invoiceUpdate.length, 1);
  assert.equal(stub.calls.invoiceUpdate[0].where.id, 'inv_1');
  assert.equal(stub.calls.invoiceUpdate[0].where.businessId, 'biz_1');
  assert.equal(stub.calls.invoiceUpdate[0].data.status, 'PAID');
});

test('fully-paid invoice: records nothing', async () => {
  stub.setScenario('paid-invoice');
  stub.resetSettleStub();
  await settleJobPaid('biz_1', 'job_1', stub.makeTx());

  assert.equal(stub.calls.paymentCreate.length, 0);
  assert.equal(stub.calls.invoiceCreate.length, 0);
  assert.equal(stub.calls.invoiceUpdate.length, 0);
});

test('unknown job: does nothing', async () => {
  stub.setScenario('no-invoice');
  stub.resetSettleStub();
  await settleJobPaid('biz_1', 'nope', stub.makeTx());

  assert.equal(stub.calls.paymentCreate.length, 0);
  assert.equal(stub.calls.invoiceCreate.length, 0);
});
