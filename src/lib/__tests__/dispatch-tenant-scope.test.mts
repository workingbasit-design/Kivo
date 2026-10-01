/**
 * Regression tests for the 2026-10-01 /dispatch crash: the assign-technician
 * select and the Start/Complete buttons crashed the page to the Next.js
 * error boundary because src/app/actions/dispatch.ts called
 * prisma.job.update() with `where: { id }` and no businessId. The tenant
 * guard (src/lib/tenant-guard.ts) fails closed on unscoped updates, so the
 * server action threw before persisting.
 *
 * These tests stub prisma/auth and run the REAL guard assertion inside the
 * stubbed update — a regression throws TenantScopeError here, as in prod.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/dispatch-tenant-scope.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./dispatch-stub-loader.mjs', import.meta.url);

const { updateJobStatus, assignJobTechnician } = await import('@/app/actions/dispatch.ts');
const stub = await import('./dispatch-stub.mjs');

test('updateJobStatus scopes the update by businessId (no TenantScopeError)', async () => {
  stub.resetDispatchStub();
  const res = await updateJobStatus('job_1', 'IN PROGRESS');
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(stub.updateCalls.length, 1);
  assert.equal(stub.updateCalls[0].where.businessId, 'biz_1');
  assert.equal(stub.updateCalls[0].where.id, 'job_1');
  assert.equal(stub.updateCalls[0].data.status, 'IN PROGRESS');
});

test('assignJobTechnician scopes the update by businessId (no TenantScopeError)', async () => {
  stub.resetDispatchStub();
  const res = await assignJobTechnician('job_1', 'user_1');
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(stub.updateCalls.length, 1);
  assert.equal(stub.updateCalls[0].where.businessId, 'biz_1');
  assert.equal(stub.updateCalls[0].where.id, 'job_1');
  assert.equal(stub.updateCalls[0].data.assignedToId, 'user_1');
});

test('assignJobTechnician unassign path scopes the update by businessId', async () => {
  stub.resetDispatchStub();
  const res = await assignJobTechnician('job_1', '');
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(stub.updateCalls.length, 1);
  assert.equal(stub.updateCalls[0].where.businessId, 'biz_1');
  assert.equal(stub.updateCalls[0].data.assignedToId, null);
});
