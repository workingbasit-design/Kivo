/**
 * TOTP two-factor authentication (Prompt 3, B7.4). Hand-rolled RFC 6238 -
 * HMAC-SHA1, 30-second steps, 6 digits - so no new dependency is needed.
 *
 * Secrets are stored ENCRYPTED (via @/lib/crypto) on the User row; backup
 * codes are stored as SHA-256 hashes (single-use). Verification accepts a
 * ±1 step window for clock skew.
 *
 * Pure except for crypto; runs under plain node:test.
 */
import { createHmac, randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // a TOTP login challenge lives 5 minutes

function challengeKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || process.env.MESSAGING_ENC_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY is not set.');
  return Buffer.from(raw, 'base64');
}

/**
 * Issue a stateless, HMAC-signed TOTP login challenge after the password
 * step succeeds. Binds userId + expiry; the client returns it with the code.
 */
export function signTotpChallenge(userId: string, nowMs: number = Date.now()): string {
  const exp = nowMs + CHALLENGE_TTL_MS;
  const body = `v1.${userId}.${exp}`;
  const sig = createHmac('sha256', challengeKey()).update(body, 'utf8').digest('hex');
  return `${body}.${sig}`;
}

/** Verify a challenge; returns the userId or null when invalid/expired. */
export function verifyTotpChallenge(challenge: string, nowMs: number = Date.now()): string | null {
  const parts = challenge.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  const [, userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!userId || !Number.isFinite(exp) || exp < nowMs) return null;
  const body = `v1.${userId}.${exp}`;
  const expected = createHmac('sha256', challengeKey()).update(body, 'utf8').digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW_STEPS = 1; // accept ±1 step for clock skew

/** Generate a fresh 160-bit TOTP secret, base32-encoded (no padding). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32 character.');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function counterFor(atMs: number): bigint {
  return BigInt(Math.floor(atMs / 1000 / TOTP_STEP_SECONDS));
}

/** Compute the TOTP code for a secret at a given time (default: now). */
export function totpCode(secret: string, atMs: number = Date.now()): string {
  const key = base32Decode(secret);
  const counter = counterFor(atMs);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(counter);
  const hmac = createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

/** Verify a 6-digit code against the secret, accepting ±1 step of skew. */
export function verifyTotp(secret: string, code: string, atMs: number = Date.now()): boolean {
  const clean = code.replace(/[\s-]/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const stepMs = TOTP_STEP_SECONDS * 1000;
  for (let d = -TOTP_WINDOW_STEPS; d <= TOTP_WINDOW_STEPS; d++) {
    const expected = totpCode(secret, atMs + d * stepMs);
    const a = Buffer.from(expected);
    const b = Buffer.from(clean);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** otpauth:// URL for manual entry into any authenticator app. */
export function totpOtpAuthUrl(secret: string, accountName: string, issuer = 'EveryJob'): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
}

/** Generate 10 single-use backup codes; store only the hashes. */
export function generateBackupCodes(): { codes: string[]; hashes: string[] } {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    // 8 digits in 4-4 groups, easy to read out loud.
    const n = randomBytes(4).readUInt32BE(0) % 100_000_000;
    codes.push(String(n).padStart(8, '0').replace(/(\d{4})(\d{4})/, '$1-$2'));
  }
  return { codes, hashes: codes.map(hashBackupCode) };
}

export function hashBackupCode(code: string): string {
  return createHash('sha256').update(code.replace(/[\s-]/g, ''), 'utf8').digest('hex');
}

/**
 * Consume one backup code: returns the remaining hashes when the code is
 * valid (caller persists them), or null when invalid/already used.
 */
export function consumeBackupCode(storedHashes: string[], code: string): string[] | null {
  const h = hashBackupCode(code);
  const idx = storedHashes.indexOf(h);
  if (idx === -1) return null;
  return [...storedHashes.slice(0, idx), ...storedHashes.slice(idx + 1)];
}
