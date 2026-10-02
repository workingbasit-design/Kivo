/**
 * Wiring regression tests for the 2026-10-01 earnings-math fix.
 *
 * Bug: updateJobStatus(jobId, 'PAID') flipped only the status — no payment
 * was recorded, so "Collected" and monthly revenue (payment-based) showed
 * $0.00 while job-based earnings showed the job's price.
 *
 * Fix: the PAID transition now runs the status update AND settleJobPaid()
 * inside ONE transaction. These tests prove the wiring: PAID settles,
 * other statuses don't, and both happen atomically.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/mark-paid-wiring.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./jobs-stub-loader.mjs', import.meta.url);

const { updateJobStatus } = await import('@/app/actions/jobs.ts');
const stub = await import('./jobs-stub.mjs');

test('PAID transition settles the money in the same transaction', async () => {
  stub.resetJobsStub();
  const res = await updateJobStatus('job_1', 'PAID');
  assert.equal(res.ok, true, JSON.stringify(res));

  // Status update happened inside the transaction…
  assert.equal(stub.calls.transactions, 1);
  assert.equal(stub.calls.jobUpdate.length, 1);
  assert.equal(stub.calls.jobUpdate[0].data.status, 'PAID');
  assert.equal(stub.calls.jobUpdate[0].where.businessId, 'biz_1');

  // …and settle ran with the same scope, inside that transaction.
  assert.equal(stub.calls.settle.length, 1);
  assert.equal(stub.calls.settle[0].businessId, 'biz_1');
  assert.equal(stub.calls.settle[0].jobId, 'job_1');
  assert.equal(stub.calls.settle[0].inTransaction, true);
});

test('non-PAID transition does not settle', async () => {
  stub.resetJobsStub();
  const res = await updateJobStatus('job_1', 'IN PROGRESS');
  assert.equal(res.ok, true, JSON.stringify(res));

  assert.equal(stub.calls.jobUpdate.length, 1);
  assert.equal(stub.calls.jobUpdate[0].data.status, 'IN PROGRESS');
  assert.equal(stub.calls.settle.length, 0);
  assert.equal(stub.calls.transactions, 0);
});
