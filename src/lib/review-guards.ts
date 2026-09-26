/**
 * Bot protection for the public review-token form (CAPTCHA-or-equivalent).
 *
 * The spec asks for CAPTCHA *or equivalent* on public submission forms.
 * This form is already hard to abuse — it requires an unguessable 256-bit
 * single-use token, and it's rate-limited per business and per IP — so the
 * equivalent here is: a honeypot field (invisible to humans, irresistible
 * to naive bots) plus a minimum fill-time check (bots submit instantly).
 * Both are validated server-side; the client can't bypass them.
 *
 * UPGRADE PATH: if automated abuse is ever observed, swap checkBotSignals
 * for Cloudflare Turnstile server-side token verification. The call site
 * (submitTokenReview) is the single place to change.
 */

/** Minimum seconds between the form rendering and an acceptable submit. */
export const REVIEW_MIN_FILL_SECONDS = 3;

export type BotCheckResult =
  | { ok: true }
  | { ok: false; reason: 'honeypot' | 'too-fast' };

/**
 * Pure check — no I/O, fully unit-testable. `renderedAtMs` is the
 * client-reported form render time; the server compares against its clock.
 */
export function checkBotSignals(opts: {
  honeypot: string;
  renderedAtMs: number;
  nowMs?: number;
}): BotCheckResult {
  if (opts.honeypot.trim() !== '') return { ok: false, reason: 'honeypot' };
  const now = opts.nowMs ?? Date.now();
  if (
    !Number.isFinite(opts.renderedAtMs) ||
    now - opts.renderedAtMs < REVIEW_MIN_FILL_SECONDS * 1000
  ) {
    return { ok: false, reason: 'too-fast' };
  }
  return { ok: true };
}

/**
 * Classify a pre-moat review source for the one-time backfill.
 * 'Verified' (moat reviews) and 'Google' (synced, real) are preserved;
 * everything else recorded before the moat becomes 'Legacy'.
 */
export function classifyLegacySource(
  source: string | null | undefined
): 'Verified' | 'Google' | 'Legacy' {
  if (source === 'Verified' || source === 'Google') return source;
  return 'Legacy';
}
