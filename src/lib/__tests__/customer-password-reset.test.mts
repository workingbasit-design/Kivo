/**
 * P1.0 (audit slice B, B-6): customer forgot-password.
 *
 * Customers had no reset flow at all — a forgotten password meant a lost
 * account. The flow mirrors the business reset (same token helpers, same
 * 1h single-use tokens, same enumeration-safe request, same session
 * invalidation on confirm), against the CustomerPasswordResetToken table.
 *
 * Runs against the REAL actions with the stubbed Prisma from auth-stub.mjs
 * (same harness as auth-rate-limit.test.mts). appBaseUrl is stubbed to
 * null, so the email send is skipped — the token creation is what's under
 * test here; the email path is covered by the shared template + live-verify.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./auth-stub-loader.mjs', import.meta.url);

const {
  requestCustomerPasswordReset,
  resetCustomerPassword,
} = await import('@/app/actions/customer-password-reset.ts');
const { newResetToken, hashResetToken } = await import('@/lib/password-reset.ts');
const stub = await import('./auth-stub.mjs');

function fd(fields) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, String(v));
  return f;
}

const CUSTOMER = { id: 'cust-reset-1', email: 'reset@example.com', name: 'Reset User' };

test('request: unknown email still returns ok and creates no token (no enumeration)', async () => {
  stub.resetAuthStub();
  stub.setTestIp('10.20.0.1');
  const r = await requestCustomerPasswordReset({}, fd({ email: 'nobody@example.com' }));
  assert.deepEqual(r, { ok: true });
  assert.equal(stub.__customerResetTokens.size, 0);
});

test('request: known email creates exactly one live token', async () => {
  stub.resetAuthStub();
  stub.setTestIp('10.20.0.2');
  stub.setCustomerUser({ ...CUSTOMER });
  const r = await requestCustomerPasswordReset({}, fd({ email: CUSTOMER.email }));
  assert.deepEqual(r, { ok: true });
  assert.equal(stub.__customerResetTokens.size, 1);
  const [row] = [...stub.__customerResetTokens.values()];
  assert.equal(row.customerId, CUSTOMER.id);
  assert.equal(row.usedAt, null);
  assert.ok(row.expiresAt.getTime() > Date.now());
});

test('request: a second request retires the first token (one live token)', async () => {
  stub.resetAuthStub();
  stub.setTestIp('10.20.0.3');
  stub.setCustomerUser({ ...CUSTOMER });
  await requestCustomerPasswordReset({}, fd({ email: CUSTOMER.email }));
  const first = [...stub.__customerResetTokens.values()][0];
  await requestCustomerPasswordReset({}, fd({ email: CUSTOMER.email }));
  assert.equal(stub.__customerResetTokens.size, 1);
  const [row] = [...stub.__customerResetTokens.values()];
  assert.notEqual(row.tokenHash, first.tokenHash);
});

test('confirm: valid token resets the password, marks the token used, and kills all sessions', async () => {
  stub.resetAuthStub();
  stub.setTestIp('10.20.0.4');
  stub.setCustomerUser({ ...CUSTOMER, passwordHash: 'old-hash' });
  stub.__seedCustomerSession('sess-a', CUSTOMER.id);
  stub.__seedCustomerSession('sess-b', CUSTOMER.id);
  assert.equal(stub.__customerSessionCount(CUSTOMER.id), 2);

  const raw = newResetToken();
  stub.__customerResetTokens.set(hashResetToken(raw), {
    id: 'crt-test-1',
    customerId: CUSTOMER.id,
    tokenHash: hashResetToken(raw),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    usedAt: null,
    createdAt: new Date(),
  });

  // High-entropy password: not in HIBP (and HIBP fails open offline anyway).
  const r = await resetCustomerPassword(
    {},
    fd({ token: raw, password: 'ResetTest-9f3kL8qZ2wX7!' }),
  );
  assert.deepEqual(r, { ok: true });
  assert.equal(stub.__customerResetTokens.get(hashResetToken(raw)).usedAt !== null, true);
  assert.equal(stub.__customerSessionCount(CUSTOMER.id), 0);
});

test('confirm: the same token cannot be reused (single-use)', async () => {
  stub.resetAuthStub();
  stub.setTestIp('10.20.0.5');
  stub.setCustomerUser({ ...CUSTOMER, passwordHash: 'old-hash' });
  const raw = newResetToken();
  stub.__customerResetTokens.set(hashResetToken(raw), {
    id: 'crt-test-2',
    customerId: CUSTOMER.id,
    tokenHash: hashResetToken(raw),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    usedAt: new Date(), // already used
    createdAt: new Date(),
  });
  const r = await resetCustomerPassword(
    {},
    fd({ token: raw, password: 'ResetTest-9f3kL8qZ2wX7!' }),
  );
  assert.match(r.error ?? '', /invalid or has expired/);
});

test('confirm: garbage token and short password are rejected', async () => {
  stub.resetAuthStub();
  stub.setTestIp('10.20.0.6');
  const bad = await resetCustomerPassword(
    {},
    fd({ token: 'not-a-real-token', password: 'ResetTest-9f3kL8qZ2wX7!' }),
  );
  assert.match(bad.error ?? '', /invalid or has expired/);
  const short = await resetCustomerPassword(
    {},
    fd({ token: 'x', password: 'short' }),
  );
  assert.match(short.error ?? '', /invalid/);
});
