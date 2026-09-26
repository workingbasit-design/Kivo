/**
 * Password-reset token helpers (pure functions — unit-testable without a DB).
 *
 * The raw token is emailed once and never persisted; only its SHA-256 hash
 * is stored (PasswordResetToken.tokenHash). Tokens are single-use
 * (usedAt) and expire after 1 hour.
 */
import { randomBytes, createHash } from 'crypto';

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Generate a URL-safe raw token for the reset link. */
export function newResetToken(): string {
  return randomBytes(32).toString('hex');
}

/** Hash a raw token for storage / lookup. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface ResetTokenRow {
  usedAt: Date | null;
  expiresAt: Date;
}

/** A stored token is usable when it hasn't been used and hasn't expired. */
export function isResetTokenUsable(row: ResetTokenRow, now = Date.now()): boolean {
  if (row.usedAt) return false;
  return row.expiresAt.getTime() > now;
}
