import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Track 9 — encryption at rest for provider secrets (Meta access tokens,
 * Resend API keys). AES-256-GCM with a server-side key.
 *
 * Key source: the `MESSAGING_ENC_KEY` env var, a base64-encoded 32-byte key.
 * Generate one with:  openssl rand -base64 32
 *
 * Stored format: `enc:v1:<iv b64>:<ciphertext b64>:<tag b64>`.
 * decryptSecret() passes through values without the prefix unchanged so
 * rows written before encryption was introduced keep working until re-saved.
 *
 * Server-only: never import from client components.
 */

const PREFIX = 'enc:v1:';

function keyBytes(): Buffer {
  const raw = process.env.MESSAGING_ENC_KEY;
  if (!raw) {
    throw new Error(
      'MESSAGING_ENC_KEY is not set. Generate one with `openssl rand -base64 32` ' +
        'and add it to the server environment before connecting messaging providers.'
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('MESSAGING_ENC_KEY must be a base64-encoded 32-byte key.');
  }
  return key;
}

export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  if (plain.startsWith(PREFIX)) return plain; // already encrypted
  const key = keyBytes();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    PREFIX +
    iv.toString('base64') +
    ':' +
    ciphertext.toString('base64') +
    ':' +
    tag.toString('base64')
  );
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext row
  const key = keyBytes();
  const parts = stored.slice(PREFIX.length).split(':');
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

/** True when the value is stored encrypted (for UI badges, never the secret). */
export function isEncrypted(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(PREFIX);
}
