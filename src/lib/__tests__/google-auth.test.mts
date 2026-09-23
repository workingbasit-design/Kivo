/**
 * Unit tests for Google sign-in (OIDC) pure logic (src/lib/google-auth.ts —
 * Track 7). All HTTP is mocked; no live Google calls.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/google-auth.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  buildGoogleSignInUrl,
  safeRedirectPath,
  randomOAuthValue,
  verifyGoogleIdToken,
  validateCanadianPhone,
  resolveGoogleAccount,
  clearGoogleCertsCache,
  GOOGLE_OIDC_AUTH_URL,
} from '@/lib/google-auth.ts';

/* ------------------------------------------------------------------ */
/* URL building + redirect safety                                      */
/* ------------------------------------------------------------------ */

test('buildGoogleSignInUrl includes OIDC params, state and nonce', () => {
  const url = new URL(
    buildGoogleSignInUrl({
      clientId: 'cid123',
      redirectUri: 'https://app.example/api/auth/google/callback',
      state: 'state-abc',
      nonce: 'nonce-xyz',
    })
  );
  assert.equal(`${url.origin}${url.pathname}`, GOOGLE_OIDC_AUTH_URL);
  assert.equal(url.searchParams.get('client_id'), 'cid123');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://app.example/api/auth/google/callback');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('state'), 'state-abc');
  assert.equal(url.searchParams.get('nonce'), 'nonce-xyz');
  const scope = url.searchParams.get('scope') ?? '';
  assert.ok(scope.includes('openid'));
  assert.ok(scope.includes('email'));
  assert.ok(scope.includes('profile'));
});

test('safeRedirectPath allows same-origin paths only', () => {
  assert.equal(safeRedirectPath('/dashboard'), '/dashboard');
  assert.equal(safeRedirectPath('/jobs/123'), '/jobs/123');
  assert.equal(safeRedirectPath('https://evil.example/phish'), '/dashboard');
  assert.equal(safeRedirectPath('//evil.example/phish'), '/dashboard');
  assert.equal(safeRedirectPath(''), '/dashboard');
  assert.equal(safeRedirectPath(null), '/dashboard');
  assert.equal(safeRedirectPath(undefined), '/dashboard');
  assert.equal(safeRedirectPath('/\\evil'), '/dashboard');
});

test('randomOAuthValue produces unique URL-safe values', () => {
  const a = randomOAuthValue();
  const b = randomOAuthValue();
  assert.notEqual(a, b);
  assert.ok(/^[A-Za-z0-9_-]+$/.test(a));
  assert.ok(a.length >= 40);
});

/* ------------------------------------------------------------------ */
/* ID token verification (mocked Google certs)                         */
/* ------------------------------------------------------------------ */

function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function makeKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const jwk = crypto.createPublicKey(publicKey).export({ format: 'jwk' }) as {
    kty: string;
    n: string;
    e: string;
  };
  return { publicKey, privateKey, jwk };
}

function signJwt(header: object, payload: object, privateKeyPem: string): string {
  const h = b64url(header);
  const p = b64url(payload);
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${h}.${p}`);
  const sig = signer.sign(privateKeyPem).toString('base64url');
  return `${h}.${p}.${sig}`;
}

const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
const NONCE = 'test-nonce-123';

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    iss: 'accounts.google.com',
    aud: CLIENT_ID,
    sub: 'google-sub-999',
    email: 'martin@example.ca',
    email_verified: true,
    name: 'Martin Roy',
    nonce: NONCE,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

function mockCertsFetch(jwkWithKid: object) {
  return (async () => ({
    ok: true,
    status: 200,
    json: async () => ({ keys: [jwkWithKid] }),
  })) as unknown as typeof fetch;
}

test('verifyGoogleIdToken accepts a properly signed token', async () => {
  clearGoogleCertsCache();
  const { privateKey, jwk } = makeKeypair();
  const token = signJwt({ alg: 'RS256', kid: 'kid-1', typ: 'JWT' }, validPayload(), privateKey);
  const res = await verifyGoogleIdToken({
    idToken: token,
    clientId: CLIENT_ID,
    expectedNonce: NONCE,
    fetchImpl: mockCertsFetch({ ...jwk, kid: 'kid-1' }),
  });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.claims.sub, 'google-sub-999');
    assert.equal(res.claims.email, 'martin@example.ca');
    assert.equal(res.claims.emailVerified, true);
    assert.equal(res.claims.name, 'Martin Roy');
  }
});

test('verifyGoogleIdToken rejects a tampered payload', async () => {
  clearGoogleCertsCache();
  const { privateKey, jwk } = makeKeypair();
  const token = signJwt({ alg: 'RS256', kid: 'kid-1', typ: 'JWT' }, validPayload(), privateKey);
  const [h, p, s] = token.split('.');
  const tamperedPayload = Buffer.from(
    JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), email: 'attacker@evil.example' })
  ).toString('base64url');
  const res = await verifyGoogleIdToken({
    idToken: `${h}.${tamperedPayload}.${s}`,
    clientId: CLIENT_ID,
    expectedNonce: NONCE,
    fetchImpl: mockCertsFetch({ ...jwk, kid: 'kid-1' }),
  });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.error, 'bad_signature');
});

test('verifyGoogleIdToken rejects wrong audience, expiry, nonce, issuer, unverified email', async () => {
  const { privateKey, jwk } = makeKeypair();
  const fetchImpl = mockCertsFetch({ ...jwk, kid: 'kid-1' });
  const check = async (payload: Record<string, unknown>, expected: string) => {
    clearGoogleCertsCache();
    const token = signJwt({ alg: 'RS256', kid: 'kid-1', typ: 'JWT' }, payload, privateKey);
    const res = await verifyGoogleIdToken({
      idToken: token,
      clientId: CLIENT_ID,
      expectedNonce: NONCE,
      fetchImpl,
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error, expected);
  };

  await check(validPayload({ aud: 'other-client' }), 'bad_audience');
  await check(validPayload({ exp: Math.floor(Date.now() / 1000) - 7200 }), 'expired');
  await check(validPayload({ nonce: 'wrong-nonce' }), 'bad_nonce');
  await check(validPayload({ iss: 'https://evil.example' }), 'bad_issuer');
  await check(validPayload({ email_verified: false }), 'email_unverified');
});

test('verifyGoogleIdToken rejects tokens signed by an unknown key', async () => {
  clearGoogleCertsCache();
  const { privateKey } = makeKeypair(); // signed by key A...
  const { jwk: jwkB } = makeKeypair(); // ...but only key B is published
  const token = signJwt({ alg: 'RS256', kid: 'kid-A', typ: 'JWT' }, validPayload(), privateKey);
  const res = await verifyGoogleIdToken({
    idToken: token,
    clientId: CLIENT_ID,
    expectedNonce: NONCE,
    fetchImpl: mockCertsFetch({ ...jwkB, kid: 'kid-B' }),
  });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.error, 'unknown_key');
});

test('verifyGoogleIdToken handles cert fetch failure', async () => {
  clearGoogleCertsCache();
  const { privateKey } = makeKeypair();
  const token = signJwt({ alg: 'RS256', kid: 'kid-1', typ: 'JWT' }, validPayload(), privateKey);
  const res = await verifyGoogleIdToken({
    idToken: token,
    clientId: CLIENT_ID,
    expectedNonce: NONCE,
    fetchImpl: (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch,
  });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.error, 'certs_fetch_failed');
});

/* ------------------------------------------------------------------ */
/* Canadian phone validation                                           */
/* ------------------------------------------------------------------ */

test('validateCanadianPhone accepts common Canadian formats', () => {
  for (const input of ['(416) 555-1234', '416-555-1234', '4165551234', '+1 416 555 1234', '1-416-555-1234']) {
    const r = validateCanadianPhone(input);
    assert.equal(r.ok, true, `expected ok for ${input}`);
    if (r.ok) {
      assert.equal(r.digits, '14165551234');
      assert.equal(r.display, '(416) 555-1234');
    }
  }
});

test('validateCanadianPhone rejects invalid numbers', () => {
  const bad = [
    '', // required
    '   ',
    '123', // too short
    '416555123', // 9 digits
    '141655512345', // too long
    '0165551234', // area code starts with 0
    '1165551234', // area code starts with 1
    '4160551234', // exchange starts with 0
    '4161551234', // exchange starts with 1
    'abcdefghij',
  ];
  for (const input of bad) {
    const r = validateCanadianPhone(input);
    assert.equal(r.ok, false, `expected failure for ${JSON.stringify(input)}`);
  }
  assert.equal((validateCanadianPhone('') as { errorKey: string }).errorKey, 'phoneRequired');
  assert.equal((validateCanadianPhone('123') as { errorKey: string }).errorKey, 'phoneInvalid');
});

/* ------------------------------------------------------------------ */
/* Account resolution                                                  */
/* ------------------------------------------------------------------ */

test('resolveGoogleAccount: googleId match logs in', () => {
  const r = resolveGoogleAccount(
    { sub: 'g1', email: 'a@b.ca', emailVerified: true },
    { id: 'user-1' },
    { id: 'user-2' }
  );
  assert.deepEqual(r, { action: 'login', userId: 'user-1' });
});

test('resolveGoogleAccount: verified email match links (no duplicate)', () => {
  const r = resolveGoogleAccount(
    { sub: 'g-new', email: 'a@b.ca', emailVerified: true },
    null,
    { id: 'user-2' }
  );
  assert.deepEqual(r, { action: 'link', userId: 'user-2' });
});

test('resolveGoogleAccount: unknown identity creates a tenant', () => {
  const r = resolveGoogleAccount(
    { sub: 'g-new', email: 'new@b.ca', emailVerified: true },
    null,
    null
  );
  assert.deepEqual(r, { action: 'create' });
});

test('resolveGoogleAccount: unverified email is refused', () => {
  const r = resolveGoogleAccount(
    { sub: 'g1', email: 'a@b.ca', emailVerified: false },
    null,
    { id: 'user-2' }
  );
  assert.deepEqual(r, { action: 'error', reason: 'email_unverified' });
});
