/**
 * Regression tests for the 2026-11-11 security audit fixes:
 * - F1: session ids are 256-bit (randomBytes(32) hex) and cookies carry
 *   the `__Host-` prefix in production (src/lib/auth.ts,
 *   src/lib/customer-auth.ts, src/lib/session-cookie.ts)
 * - F2: a live Stripe platform key is refused unless ALLOW_STRIPE_LIVE
 *   is set (src/lib/stripe.ts)
 * - F3: JSON-LD is `<`-escaped so a business name cannot break out of
 *   its `<script>` block (src/lib/jsonld.ts)
 *
 * The REAL session/stripe/jsonld modules are under test; framework +
 * data modules are stubbed via session-stub-loader.mjs (same pattern
 * as auth-rate-limit.test.mts). No HTTP, no DB, no live Stripe calls.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/session-security.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./session-stub-loader.mjs', import.meta.url);

const { createSession, getSession, destroySession } = await import('@/lib/auth.ts');
const { createCustomerSession, getCustomerSession } = await import('@/lib/customer-auth.ts');
const {
  sessionCookieName,
  customerSessionCookieName,
  newSessionId,
} = await import('@/lib/session-cookie.ts');
const {
  assertPlatformKeyTestMode,
  createCheckoutSession,
} = await import('@/lib/stripe.ts');
const { safeJsonLd } = await import('@/lib/jsonld.ts');
const stub = await import('./session-stub.mjs');

/* ------------------------------------------------------------------ */
/* F1: cookie names                                                      */
/* ------------------------------------------------------------------ */

test('F1: production cookies carry the __Host- prefix, dev keeps the plain name', () => {
  assert.equal(sessionCookieName('production'), '__Host-kivo_session');
  assert.equal(sessionCookieName('development'), 'kivo_session');
  assert.equal(sessionCookieName('test'), 'kivo_session');
  assert.equal(sessionCookieName(undefined), 'kivo_session');
  assert.equal(customerSessionCookieName('production'), '__Host-kivo_customer_session');
  assert.equal(customerSessionCookieName('development'), 'kivo_customer_session');
});

test('F1: newSessionId is 64 lowercase hex chars (256-bit) and unique', () => {
  const a = newSessionId();
  const b = newSessionId();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.match(b, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});

/* ------------------------------------------------------------------ */
/* F1: createSession / createCustomerSession use the 256-bit id          */
/* ------------------------------------------------------------------ */

test('F1: createSession stores a 256-bit id and sets it as the session cookie', async () => {
  stub.resetSessionStub();
  const session = await createSession('user_1');
  const args = stub.getSessionCreateArgs();
  assert.ok(args, 'prisma.session.create should have been called');
  assert.match(args.id, /^[0-9a-f]{64}$/, 'session id must be 256-bit hex, not cuid()');
  assert.equal(args.userId, 'user_1');
  assert.equal(session.id, args.id);
  // 7-day expiry (within a minute of tolerance).
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  assert.ok(Math.abs(args.expiresAt.getTime() - (Date.now() + sevenDaysMs)) < 60_000);
  // Cookie set under the (env-dependent) session cookie name.
  const jar = stub.getCookieJar();
  assert.equal(jar.get(sessionCookieName()), args.id);
});

test('F1: createCustomerSession stores a 256-bit id and sets the customer cookie', async () => {
  stub.resetSessionStub();
  const session = await createCustomerSession('cust_1');
  const args = stub.getCustomerSessionCreateArgs();
  assert.ok(args, 'prisma.customerSession.create should have been called');
  assert.match(args.id, /^[0-9a-f]{64}$/, 'customer session id must be 256-bit hex, not cuid()');
  assert.equal(args.customerId, 'cust_1');
  assert.equal(session.id, args.id);
  const jar = stub.getCookieJar();
  assert.equal(jar.get(customerSessionCookieName()), args.id);
});

test('F1: getSession validates the presented cookie; expired rows are deleted', async () => {
  stub.resetSessionStub();
  const jar = stub.getCookieJar();
  // Valid session.
  const goodId = newSessionId();
  stub.setSessionRow({
    id: goodId,
    userId: 'user_1',
    expiresAt: new Date(Date.now() + 60_000),
    user: { id: 'user_1' },
  });
  jar.set(sessionCookieName(), goodId);
  const found = await getSession();
  assert.ok(found);
  assert.equal(found.id, goodId);

  // Expired session: null + the exact row deleted.
  const staleId = newSessionId();
  stub.setSessionRow({
    id: staleId,
    userId: 'user_1',
    expiresAt: new Date(Date.now() - 60_000),
    user: { id: 'user_1' },
  });
  jar.set(sessionCookieName(), staleId);
  assert.equal(await getSession(), null);
  assert.ok(stub.getDeletedSessionIds().includes(staleId));

  // No cookie at all: null, no DB hit needed.
  jar.delete(sessionCookieName());
  assert.equal(await getSession(), null);
});

test('F1: destroySession deletes the row and clears the cookie', async () => {
  stub.resetSessionStub();
  const jar = stub.getCookieJar();
  const id = newSessionId();
  jar.set(sessionCookieName(), id);
  await destroySession();
  assert.ok(stub.getDeletedSessionIds().includes(id));
  assert.equal(jar.get(sessionCookieName()), undefined);
});

test('F1: getCustomerSession validates the presented customer cookie', async () => {
  stub.resetSessionStub();
  const jar = stub.getCookieJar();
  const id = newSessionId();
  stub.setCustomerSessionRow({
    id,
    customerId: 'cust_1',
    expiresAt: new Date(Date.now() + 60_000),
    customer: { id: 'cust_1' },
  });
  jar.set(customerSessionCookieName(), id);
  const found = await getCustomerSession();
  assert.ok(found);
  assert.equal(found.id, id);
});

/* ------------------------------------------------------------------ */
/* F2: Stripe live-key guard                                             */
/* ------------------------------------------------------------------ */

test('F2: a live platform key is refused unless ALLOW_STRIPE_LIVE=true', () => {
  const prev = process.env.ALLOW_STRIPE_LIVE;
  try {
    delete process.env.ALLOW_STRIPE_LIVE;
    assert.throws(
      () => assertPlatformKeyTestMode('sk_live_abc'),
      /live mode is forbidden/
    );
    // Test keys (and restricted test keys) pass.
    assertPlatformKeyTestMode('sk_test_abc');
    assertPlatformKeyTestMode('rk_test_abc');
    assertPlatformKeyTestMode('');
    // Explicit opt-in allows live.
    process.env.ALLOW_STRIPE_LIVE = 'true';
    assertPlatformKeyTestMode('sk_live_abc');
    process.env.ALLOW_STRIPE_LIVE = 'false';
    assert.throws(
      () => assertPlatformKeyTestMode('sk_live_abc'),
      /live mode is forbidden/
    );
  } finally {
    if (prev === undefined) delete process.env.ALLOW_STRIPE_LIVE;
    else process.env.ALLOW_STRIPE_LIVE = prev;
  }
});

test('F2: createCheckoutSession refuses a live key before any Stripe call', async () => {
  const prev = process.env.ALLOW_STRIPE_LIVE;
  try {
    delete process.env.ALLOW_STRIPE_LIVE;
    let fetchCalled = false;
    const fetchFn = async () => {
      fetchCalled = true;
      throw new Error('must not be called');
    };
    await assert.rejects(
      () =>
        createCheckoutSession(
          {
            platformSecret: 'sk_live_abc',
            stripeAccountId: 'acct_123',
            amountCents: 1000,
            productName: 'Invoice INV-001 - Acme',
            successUrl: 'https://app.example/i/tok?paid=1',
            cancelUrl: 'https://app.example/i/tok',
            metadata: { kind: 'invoice', invoice_id: 'inv_1', business_id: 'biz_1' },
          },
          fetchFn as typeof fetch
        ),
      /live mode is forbidden/
    );
    assert.equal(fetchCalled, false, 'no Stripe request may be attempted with a live key');
  } finally {
    if (prev === undefined) delete process.env.ALLOW_STRIPE_LIVE;
    else process.env.ALLOW_STRIPE_LIVE = prev;
  }
});

/* ------------------------------------------------------------------ */
/* F3: JSON-LD escaping                                                  */
/* ------------------------------------------------------------------ */

test('F3: safeJsonLd escapes < so a name cannot break out of the script block', () => {
  const hostile = {
    '@type': 'LocalBusiness',
    name: 'X</script><script>alert(1)</script>',
  };
  const out = safeJsonLd(hostile);
  assert.ok(!out.includes('</script>'), 'output must not contain a literal </script>');
  assert.ok(!out.includes('<script>'), 'output must not contain a literal <script>');
  assert.ok(out.includes('\\u003c/script>'), 'the < must be \\u003c-escaped');
  // Round-trips to the identical value after JSON.parse.
  assert.deepEqual(JSON.parse(out), hostile);
});

test('F3: safeJsonLd leaves ordinary values untouched', () => {
  const value = { '@type': 'LocalBusiness', name: 'Acme Plumbing', ratingValue: 4.5 };
  assert.equal(safeJsonLd(value), JSON.stringify(value));
});
