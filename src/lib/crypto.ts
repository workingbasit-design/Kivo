/**
 * Encryption at rest for provider secrets (Prompt 3, B4.2).
 *
 * AES-256-GCM with a server-side key. Generalized from the messaging-only
 * helper (`src/lib/messaging/crypto.ts`, which now re-exports this module).
 * Used for: Google OAuth tokens, QuickBooks OAuth tokens, messaging
 * provider secrets.
 *
 * Key source: the `ENCRYPTION_KEY` env var, a base64-encoded 32-byte key.
 * Generate one with:  openssl rand -base64 32
 * Backwards compatibility: falls back to the legacy `MESSAGING_ENC_KEY` so
 * existing deployments keep working; set ENCRYPTION_KEY going forward.
 *
 * Key rotation: set `ENCRYPTION_KEY_PREVIOUS` to the old key, run
 * `scripts/rotate-encryption-key.mts` (decrypts with the old key, re-encrypts
 * with the new one), then unset `ENCRYPTION_KEY_PREVIOUS`.
 *
 * Stored format: `enc:v1:<iv b64>:<ciphertext b64>:<tag b64>`.
 * decryptSecret() passes through values without the prefix unchanged so
 * rows written before encryption was introduced keep working until re-saved
 * (and so the backfill script can distinguish plaintext rows).
 *
 * Server-only: never import from client components.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const ENC_PREFIX = 'enc:v1:';

function keyBytes(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || process.env.MESSAGING_ENC_KEY;
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY (or MESSAGING_ENC_KEY) is not set. Generate one with ' +
        '`openssl rand -base64 32` and add it to the server environment ' +
        'before connecting OAuth providers.'
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }
  return key;
}

function previousKeyBytes(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY_PREVIOUS;
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  return key.length === 32 ? key : null;
}

function encryptWithKey(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    ENC_PREFIX +
    iv.toString('base64') +
    ':' +
    ciphertext.toString('base64') +
    ':' +
    tag.toString('base64')
  );
}

function decryptWithKey(stored: string, key: Buffer): string {
  const parts = stored.slice(ENC_PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Malformed encrypted secret.');
  const [ivB64, ctB64, tagB64] = parts;
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]);
  return plain.toString('utf8');
}

/** Encrypt a plaintext secret. Idempotent: already-encrypted values pass through. */
export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  if (plain.startsWith(ENC_PREFIX)) return plain;
  return encryptWithKey(plain, keyBytes());
}

/**
 * Decrypt a stored secret. Plaintext (pre-encryption) rows pass through
 * unchanged. During rotation, falls back to ENCRYPTION_KEY_PREVIOUS.
 */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(ENC_PREFIX)) return stored; // legacy plaintext row
  try {
    return decryptWithKey(stored, keyBytes());
  } catch (err) {
    const prev = previousKeyBytes();
    if (prev) {
      try {
        return decryptWithKey(stored, prev);
      } catch {
        // fall through to the original error
      }
    }
    throw err;
  }
}

/** True when the value is stored encrypted (for UI badges, never the secret). */
export function isEncrypted(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(ENC_PREFIX);
}
