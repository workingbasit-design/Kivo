/**
 * P1.0 (audit S6 + S7): customer password hashing is async PBKDF2 with a
 * dummy-hash path on login.
 *
 * - Same params/format as the old sync version (100k, SHA-512, 64-byte,
 *   `salt:hash` hex), so every stored hash keeps verifying — no migration.
 * - verify returns false (never throws) for malformed stored hashes.
 * - The dummy hash is well-formed and never authenticates: the login path
 *   verifies against it for non-existent emails so timing no longer reveals
 *   whether an email is registered.
 * - Static check: the login action always verifies (dummy path) instead of
 *   short-circuiting on a missing customer row.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./next-server-stub-loader.mjs', import.meta.url);

const {
  hashCustomerPassword,
  verifyCustomerPassword,
  DUMMY_CUSTOMER_HASH,
} = await import('../customer-auth.ts');

describe('customer password hashing (async PBKDF2, S7)', () => {
  it('hashes and verifies a round-trip', async () => {
    const hash = await hashCustomerPassword('correct horse battery staple');
    assert.equal(await verifyCustomerPassword('correct horse battery staple', hash), true);
    assert.equal(await verifyCustomerPassword('wrong password', hash), false);
  });

  it('returns promises (async, does not block the event loop)', async () => {
    const pending = hashCustomerPassword('x');
    assert.equal(typeof (pending as Promise<string>).then, 'function');
    await pending;
    const verifyPending = verifyCustomerPassword('x', DUMMY_CUSTOMER_HASH);
    assert.equal(typeof (verifyPending as Promise<boolean>).then, 'function');
    assert.equal(await verifyPending, false);
  });

  it('keeps the salt:hash hex format (32-char salt, 128-char hash)', async () => {
    const hash = await hashCustomerPassword('another password');
    const [salt, digest] = hash.split(':');
    assert.match(salt, /^[0-9a-f]{32}$/);
    assert.match(digest, /^[0-9a-f]{128}$/);
  });

  it('salts randomly: same password hashes differently each time', async () => {
    const a = await hashCustomerPassword('same password');
    const b = await hashCustomerPassword('same password');
    assert.notEqual(a, b);
    assert.equal(await verifyCustomerPassword('same password', a), true);
    assert.equal(await verifyCustomerPassword('same password', b), true);
  });

  it('fails closed on malformed stored hashes instead of throwing', async () => {
    for (const malformed of ['', 'no-colon', 'a:b', 'short:hash', `${'a'.repeat(32)}:short`]) {
      assert.equal(await verifyCustomerPassword('anything', malformed), false);
    }
  });
});

describe('dummy hash (S6 timing-oracle fix)', () => {
  it('is a well-formed salt:hash value', () => {
    const [salt, digest] = DUMMY_CUSTOMER_HASH.split(':');
    assert.match(salt, /^[0-9a-f]{32}$/);
    assert.match(digest, /^[0-9a-f]{128}$/);
  });

  it('never authenticates any password except the one it was generated from', async () => {
    // By construction the dummy IS the hash of 'dummy' (generated once with
    // the real hash function) — that is what makes it cost a full PBKDF2.
    // No account stores it, so it can never authenticate a real login.
    assert.equal(await verifyCustomerPassword('dummy', DUMMY_CUSTOMER_HASH), true);
    assert.equal(await verifyCustomerPassword('', DUMMY_CUSTOMER_HASH), false);
    assert.equal(
      await verifyCustomerPassword('correct horse battery staple', DUMMY_CUSTOMER_HASH),
      false,
    );
  });
});

describe('login action always verifies (S6, static)', () => {
  it('uses the dummy hash path and never short-circuits on a missing customer', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      join(here, '..', '..', 'app', 'actions', 'customer-auth.ts'),
      'utf8',
    );
    assert.ok(
      src.includes('customer?.passwordHash ?? DUMMY_CUSTOMER_HASH'),
      'login must verify against the dummy hash for non-existent emails',
    );
    assert.ok(
      !src.includes('!verifyCustomerPassword(password, customer.passwordHash)'),
      'login must not short-circuit the verifier on a missing customer row',
    );
  });
});
