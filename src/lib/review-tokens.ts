/**
 * Review-request tokens (the review moat).
 *
 * A token is a 256-bit random hex string, shown to the pro exactly once as
 * part of the /rev/[token] link. Only the SHA-256 hash is stored — a
 * database leak reveals no usable review links, and tokens can't be forged
 * (guessing a 256-bit value is infeasible). Tokens are single-use with a
 * 30-day expiry and can be revoked by the pro.
 */
import { randomBytes, createHash } from 'crypto';

/** Review links expire 30 days after the pro generates them. */
export const REVIEW_TOKEN_EXPIRY_DAYS = 30;

/** Generate a new unguessable token value (shown once, never stored). */
export function newReviewTokenValue(): string {
  return randomBytes(32).toString('hex');
}

/** SHA-256 hash of a token value — this is what we store and look up. */
export function hashReviewToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** A request can accept a review only while PENDING and unexpired. */
export function isReviewRequestActive(rec: {
  status: string;
  expiresAt: Date | null;
}): boolean {
  if (rec.status !== 'PENDING') return false;
  if (rec.expiresAt && rec.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

/** Expiry timestamp for a freshly generated request. */
export function reviewRequestExpiry(nowMs: number = Date.now()): Date {
  return new Date(nowMs + REVIEW_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}
