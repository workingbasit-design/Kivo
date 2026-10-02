/**
 * Regression tests: brute-force rate limits on the authentication surface
 * (playbook layers 4 & 11).
 *
 * - Business login/register and password-reset request were IP-limited only;
 *   per-email buckets were added so IP rotation can't hammer one account
 *   (login) or flood one inbox (password reset).
 * - Customer signup/login had NO rate limiting at all; per-IP (both) and
 *   per-email (login) buckets were added.
 *
 * The REAL src/lib/rate-limit.ts backs these tests (in-memory buckets);
 * AUTH_LIMIT = 8 attempts / 10 min. Distinct IPs/emails isolate buckets
 * between tests.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/auth-rate-limit.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./auth-stub-loader.mjs', import.meta.url);

const { login, register: businessRegister } = await import('@/app/actions/auth.ts');
const { customerLogin, customerSignup } = await import('@/app/actions/customer-auth.ts');
const { requestPasswordReset } = await import('@/app/actions/password-reset.ts');
const stub = await import('./auth-stub.mjs');

function fd(fields) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, String(v));
  return f;
}

test('business login: per-email limit triggers even from a fresh IP', async () => {
  stub.resetAuthStub();
  stub.setTestIp('10.11.0.1');
  for (let i = 0; i < 8; i++) {
    const r = await login(null, fd({ email: 'victim@example.com', password: 'wrongpass1' }));
    assert.equal(r.error, 'Incorrect email or password.');
  }
  // Fresh IP — the IP bucket is clean, but the email bucket is exhausted.
  stub.setTestIp('10.11.0.2');
  const blocked = await login(null, fd({ email: 'victim@example.com', password: 'wrongpass1' }));
  assert.match(blocked.error ?? '', /Too many attempts/);
  // A different email from the same fresh IP is unaffected.
  const other = await login(null, fd({ email: 'other@example.com', password: 'wrongpass1' }));
  assert.equal(other.error, 'Incorrect email or password.');
});

test('business login: per-IP limit still triggers', async () => {
  stub.resetAuthStub();
  stub.setTestIp('10.11.1.1');
  for (let i = 0; i < 8; i++) {
    await login(null, fd({ email: `u${i}@example.com`, password: 'x' }));
  }
  const blocked = await login(null, fd({ email: 'fresh@example.com', password: 'x' }));
  assert.match(blocked.error ?? '', /Too many attempts/);
});

test('business register: per-email limit triggers from a fresh IP', async () => {
  stub.resetAuthStub();
  stub.setBusinessUser({ id: 'u1', email: 'taken@example.com' });
  const form = () =>
    fd({ name: 'T User', businessName: 'Biz Co', email: 'taken@example.com', password: 'Passw0rd1' });
  stub.setTestIp('10.11.2.1');
  for (let i = 0; i < 8; i++) {
    const r = await businessRegister(null, form());
    assert.equal(r.error, 'An account with this email already exists. Try logging in.');
  }
  stub.setTestIp('10.11.2.2');
  const blocked = await businessRegister(null, form());
  assert.match(blocked.error ?? '', /Too many attempts/);
  stub.setBusinessUser(null);
});

test('customer login: per-IP and per-email limits trigger', async () => {
  stub.resetAuthStub();
  stub.setTestIp('10.11.3.1');
  for (let i = 0; i < 8; i++) {
    const r = await customerLogin(null, fd({ email: 'cvictim@example.com', password: 'wrong' }));
    assert.equal(r.error, 'Invalid email or password.');
  }
  stub.setTestIp('10.11.3.2');
  const blocked = await customerLogin(null, fd({ email: 'cvictim@example.com', password: 'wrong' }));
  assert.match(blocked.error ?? '', /Too many attempts/);
  const other = await customerLogin(null, fd({ email: 'cother@example.com', password: 'wrong' }));
  assert.equal(other.error, 'Invalid email or password.');
});

test('customer signup: per-IP limit triggers', async () => {
  stub.resetAuthStub();
  stub.setTestIp('10.11.4.1');
  for (let i = 0; i < 8; i++) {
    const r = await customerSignup(null, fd({ name: '', email: 'x@example.com', password: 'password1' }));
    assert.equal(r.error, 'Please enter your name.');
  }
  const blocked = await customerSignup(null, fd({ name: '', email: 'x@example.com', password: 'password1' }));
  assert.match(blocked.error ?? '', /Too many attempts/);
});

test('password-reset request: per-email limit triggers from a fresh IP', async () => {
  stub.resetAuthStub();
  stub.setTestIp('10.11.5.1');
  for (let i = 0; i < 8; i++) {
    const r = await requestPasswordReset(null, fd({ email: 'resetvictim@example.com' }));
    assert.equal(r.ok, true);
  }
  stub.setTestIp('10.11.5.2');
  const blocked = await requestPasswordReset(null, fd({ email: 'resetvictim@example.com' }));
  assert.match(blocked.error ?? '', /Too many attempts/);
  const other = await requestPasswordReset(null, fd({ email: 'resetother@example.com' }));
  assert.equal(other.ok, true);
});
