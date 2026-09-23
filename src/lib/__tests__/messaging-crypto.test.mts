/**
 * Unit tests for messaging secret encryption (src/lib/messaging/crypto.ts).
 * Pure Node crypto — zero network, zero provider calls.
 * Run: node --test src/lib/__tests__/messaging-crypto.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const KEY = randomBytes(32).toString('base64');
const OTHER_KEY = randomBytes(32).toString('base64');

async function loadCrypto() {
  return import('../messaging/crypto.ts');
}

test('encryptSecret/decryptSecret round-trips', async () => {
  process.env.MESSAGING_ENC_KEY = KEY;
  const { encryptSecret, decryptSecret } = await loadCrypto();
  const stored = encryptSecret('re_pat_abcdef123456');
  assert.ok(stored.startsWith('enc:v1:'));
  assert.notEqual(stored, 're_pat_abcdef123456');
  assert.equal(decryptSecret(stored), 're_pat_abcdef123456');
});

test('encryptSecret produces different ciphertexts for the same secret (random IV)', async () => {
  process.env.MESSAGING_ENC_KEY = KEY;
  const { encryptSecret } = await loadCrypto();
  assert.notEqual(encryptSecret('same-secret'), encryptSecret('same-secret'));
});

test('decryptSecret passes through legacy plaintext rows unchanged', async () => {
  process.env.MESSAGING_ENC_KEY = KEY;
  const { decryptSecret } = await loadCrypto();
  assert.equal(decryptSecret('plain-old-token'), 'plain-old-token');
  assert.equal(decryptSecret(null), null);
  assert.equal(decryptSecret(undefined), null);
});

test('decryptSecret fails closed with the wrong key', async () => {
  process.env.MESSAGING_ENC_KEY = KEY;
  const { encryptSecret, decryptSecret } = await loadCrypto();
  const stored = encryptSecret('top-secret');
  process.env.MESSAGING_ENC_KEY = OTHER_KEY;
  assert.throws(() => decryptSecret(stored));
});

test('encryptSecret throws a clear error when MESSAGING_ENC_KEY is missing', async () => {
  delete process.env.MESSAGING_ENC_KEY;
  const { encryptSecret } = await loadCrypto();
  assert.throws(() => encryptSecret('x'), /MESSAGING_ENC_KEY/);
});

test('isEncrypted distinguishes stored formats', async () => {
  process.env.MESSAGING_ENC_KEY = KEY;
  const { encryptSecret, isEncrypted } = await loadCrypto();
  assert.equal(isEncrypted(encryptSecret('x')), true);
  assert.equal(isEncrypted('plain-old-token'), false);
  assert.equal(isEncrypted(null), false);
});
