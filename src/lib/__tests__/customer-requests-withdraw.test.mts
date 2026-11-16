/**
 * Withdraw tests for the customer open-lead flow
 * (src/app/actions/customer-requests.ts).
 *
 * Regression test for the 2026-11-16 deep-test Defect 1: an unmatched
 * directory request is saved as an OPEN DirectoryRequest linked to the
 * signed-in customer, and the customer must be able to withdraw it from
 * /customer/requests. The withdraw is scoped by id + customerId + OPEN
 * status in one updateMany, so another customer's draft, an already
 * dismissed draft, or a tampered id must be a silent no-op.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/customer-requests-withdraw.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./customer-requests-stub-loader.mjs', import.meta.url);

const { withdrawOpenLead } = await import('@/app/actions/customer-requests.ts');
const stub = await import('./customer-requests-stub.mjs');

function form(id) {
  const fd = new FormData();
  fd.set('id', id);
  return fd;
}

async function withdraw(id) {
  stub.resetCalls();
  stub.setCustomerId('cust_1');
  try {
    const res = await withdrawOpenLead(form(id));
    return { result: res, redirected: null };
  } catch (e) {
    if (e.digest === 'NEXT_REDIRECT') return { result: null, redirected: e.message };
    throw e;
  }
}

test('own OPEN draft: dismissed, list revalidated', async () => {
  const { result, redirected } = await withdraw('dr_open_mine');
  assert.equal(redirected, null);
  assert.equal(result?.ok, true);
  assert.equal(stub.directoryRequests.get('dr_open_mine').status, 'DISMISSED');
  assert.deepEqual(stub.calls.revalidated, ['/customer/requests']);
});

test("another customer's OPEN draft: silent no-op, still OPEN", async () => {
  const { result } = await withdraw('dr_open_other');
  assert.equal(result?.error, 'Request not found.');
  assert.equal(stub.directoryRequests.get('dr_open_other').status, 'OPEN');
  assert.deepEqual(stub.calls.revalidated, []);
});

test('own already-dismissed draft: silent no-op', async () => {
  const { result } = await withdraw('dr_done_mine');
  assert.equal(result?.error, 'Request not found.');
  assert.equal(stub.directoryRequests.get('dr_done_mine').status, 'DISMISSED');
});

test('unknown id: silent no-op', async () => {
  const { result } = await withdraw('dr_nope');
  assert.equal(result?.error, 'Request not found.');
});

test('signed out: redirected to customer login', async () => {
  stub.resetCalls();
  stub.setCustomerId(null);
  try {
    await withdrawOpenLead(form('dr_open_mine'));
    assert.fail('expected a redirect');
  } catch (e) {
    assert.equal(e.digest, 'NEXT_REDIRECT');
    assert.ok(String(e.message).includes('/customer/login'));
  }
  assert.equal(stub.directoryRequests.get('dr_open_mine').status, 'OPEN');
});
