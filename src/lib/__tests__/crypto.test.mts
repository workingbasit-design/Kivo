/**
 * B4.2 OAuth token encryption tests. AES-256-GCM via src/lib/crypto.ts.
 * Uses a throwaway test key - never a real one.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { encryptSecret, decryptSecret, isEncrypted } from '../crypto.ts';

const TEST_KEY = randomBytes(32).toString('base64');

describe('oauth token encryption (B4.2)', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    delete process.env.ENCRYPTION_KEY_PREVIOUS;
  });

  it('encrypts to a non-plaintext value with the enc:v1: prefix', () => {
    const token = 'ya29.a0AfH6SMBx-real-looking-google-token';
    const stored = encryptSecret(token);
    assert.ok(stored.startsWith('enc:v1:'), 'stored value must carry the enc prefix');
    assert.ok(!stored.includes(token), 'stored value must not contain the plaintext token');
    assert.ok(!stored.includes('ya29.'), 'no plaintext OAuth prefix may survive');
    assert.equal(isEncrypted(stored), true);
  });

  it('round-trips through decrypt', () => {
    const token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.quickbooks';
    assert.equal(decryptSecret(encryptSecret(token)), token);
  });

  it('is idempotent - encrypting twice does not double-wrap', () => {
    const once = encryptSecret('secret-token');
    assert.equal(encryptSecret(once), once);
  });

  it('passes legacy plaintext rows through unchanged', () => {
    // Rows written before B4.2 keep working until the backfill encrypts them.
    assert.equal(decryptSecret('ya29.plaintext-legacy'), 'ya29.plaintext-legacy');
    assert.equal(decryptSecret(null), null);
    assert.equal(isEncrypted('ya29.plaintext-legacy'), false);
  });

  it('each encryption uses a fresh IV (same input -> different ciphertext)', () => {
    const a = encryptSecret('same-token');
    const b = encryptSecret('same-token');
    assert.notEqual(a, b);
    assert.equal(decryptSecret(a), 'same-token');
    assert.equal(decryptSecret(b), 'same-token');
  });

  it('rotation fallback: decrypts with ENCRYPTION_KEY_PREVIOUS', () => {
    const oldKey = randomBytes(32).toString('base64');
    const newKey = randomBytes(32).toString('base64');
    process.env.ENCRYPTION_KEY = oldKey;
    const stored = encryptSecret('rotating-token');
    // Simulate rotation: new primary key, old key as previous.
    process.env.ENCRYPTION_KEY = newKey;
    process.env.ENCRYPTION_KEY_PREVIOUS = oldKey;
    assert.equal(decryptSecret(stored), 'rotating-token');
  });

  it('throws a clear error when no key is configured', () => {
    delete process.env.ENCRYPTION_KEY;
    delete process.env.MESSAGING_ENC_KEY;
    assert.throws(() => encryptSecret('x'), /ENCRYPTION_KEY.*is not set/);
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });
});
