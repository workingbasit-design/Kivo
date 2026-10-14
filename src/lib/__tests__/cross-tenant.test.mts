/**
 * B1.1 cross-tenant test: Business B requesting Business A's attachment ID
 * must get 404 (not 403, not the bytes) and the query must be scoped by
 * businessId. Uses the in-memory stub (no database).
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/cross-tenant.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./attachments-route-stub-loader.mjs', import.meta.url);

const { GET } = await import('@/app/api/attachments/[id]/route.ts');
const stub = await import('./attachments-route-stub.mjs');

function req(id: string) {
  return new Request(`https://app.test/api/attachments/${id}`);
}

test('B1.1: Business B fetching Business A\'s attachment → 404, no bytes leak', async () => {
  stub.resetStub();
  stub.setSessionBusinessId('biz-b'); // caller is Business B
  const res = await GET(req('att-a'), { params: Promise.resolve({ id: 'att-a' }) });
  assert.equal(res.status, 404);
  // The query was scoped by the CALLER's businessId - the canary proves it:
  // { id: 'att-a', businessId: 'biz-b' } matches nothing.
  assert.deepEqual(stub.calls.findFirst[0], { id: 'att-a', businessId: 'biz-b' });
  const body = await res.text();
  assert.ok(!body.includes('blob.test'), 'response must not contain the blob URL');
});

test('B1.1: unauthenticated request → 401', async () => {
  stub.resetStub();
  stub.setSessionBusinessId(null as unknown as string);
  const res = await GET(req('att-a'), { params: Promise.resolve({ id: 'att-a' }) });
  assert.equal(res.status, 401);
});

test('B1.1: nonexistent attachment → 404 (same as cross-tenant: no existence oracle)', async () => {
  stub.resetStub();
  stub.setSessionBusinessId('biz-b');
  const res = await GET(req('att-nope'), { params: Promise.resolve({ id: 'att-nope' }) });
  assert.equal(res.status, 404);
});
