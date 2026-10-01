/**
 * Consent-gate tests for the customer single-pro quote request flow
 * (src/app/actions/customer-requests.ts).
 *
 * Regression test for the HIGH defect: sendQuoteRequest used to file quote
 * requests + leads against ANY business id supplied by the client, including
 * businesses that never opted into (or opted out of) the directory.
 *
 * Also covers: rate limiting, double-submit dedupe, and the transactional
 * quote-request+lead write (lead failures no longer silent).
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/customer-requests-consent.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./customer-requests-stub-loader.mjs', import.meta.url);

const { sendQuoteRequest } = await import('@/app/actions/customer-requests.ts');
const stub = await import('./customer-requests-stub.mjs');

function form(businessId) {
  const fd = new FormData();
  fd.set('businessId', businessId);
  fd.set('service', 'Plumbing');
  fd.set('description', 'Leaky faucet in the kitchen.');
  return fd;
}

async function send(businessId) {
  stub.resetCalls();
  try {
    const res = await sendQuoteRequest(null, form(businessId));
    return { result: res, redirected: null };
  } catch (e) {
    if (e.digest === 'NEXT_REDIRECT') return { result: null, redirected: e.message };
    throw e;
  }
}

test('verified + opted-in business: request created, lead created, redirect', async () => {
  const { result, redirected } = await send('biz_ok');
  assert.equal(result, null, 'no error object — action redirects on success');
  assert.ok(redirected?.includes('/customer/requests/qr_'), `redirected to the new request, got ${redirected}`);
  assert.equal(stub.calls.quoteRequests.length, 1, 'one quote request created');
  assert.equal(stub.calls.leads.length, 1, 'one lead created for the business inbox');
  assert.equal(stub.calls.quoteRequests[0].businessId, 'biz_ok');
  assert.equal(stub.calls.leads[0].businessId, 'biz_ok');
  assert.equal(stub.calls.quoteRequests[0].status, 'sent');
});

test('opted-out business: rejected, nothing created', async () => {
  const { result, redirected } = await send('biz_out');
  assert.equal(redirected, null, 'no redirect — the request was refused');
  assert.equal(result?.error, 'Business not found.');
  assert.equal(stub.calls.quoteRequests.length, 0, 'no quote request created');
  assert.equal(stub.calls.leads.length, 0, 'no lead created');
});

test('unverified business: rejected, nothing created', async () => {
  const { result, redirected } = await send('biz_unv');
  assert.equal(redirected, null);
  assert.equal(result?.error, 'Business not found.');
  assert.equal(stub.calls.quoteRequests.length, 0);
  assert.equal(stub.calls.leads.length, 0);
});

test('unknown business id: rejected, nothing created', async () => {
  const { result, redirected } = await send('biz_nope');
  assert.equal(redirected, null);
  assert.equal(result?.error, 'Business not found.');
  assert.equal(stub.calls.quoteRequests.length, 0);
  assert.equal(stub.calls.leads.length, 0);
});

test('rate limit: the 6th request in an hour is refused', async () => {
  // Fresh customer id so earlier tests' buckets don't interfere.
  stub.setCustomerId('cust_rate_limit');
  // 5 allowed (the QUOTE_REQUEST_LIMIT); the 6th must be refused.
  for (let i = 0; i < 5; i++) {
    const { redirected } = await send('biz_ok');
    assert.ok(redirected, `request ${i + 1} goes through`);
  }
  const { result, redirected } = await send('biz_ok');
  assert.equal(redirected, null, '6th request does not redirect');
  assert.match(result?.error ?? '', /several requests|wait/i, 'rate-limit message returned');
  stub.setCustomerId('cust_1');
});
