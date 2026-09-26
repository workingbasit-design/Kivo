/**
 * Honeypot + minimum-fill-time bot checks for public forms.
 *
 * Enforced SERVER-SIDE — the form fields are just carriers; a bot posting
 * directly to the action gets the same checks. This is a cheap first layer,
 * not a replacement for interactive challenges.
 *
 * Upgrade path: Cloudflare Turnstile (managed, free, privacy-friendly
 * challenge) on the public quote-request and booking forms if automated
 * abuse persists despite the honeypot + timing checks.
 */

/** Tempting name for bots; rendered aria-hidden and off-screen for humans. */
export const HONEYPOT_FIELD = 'company_website';
/** Hidden timestamp (ms since epoch) set when the form first renders. */
export const FORM_STARTED_FIELD = 'form_started_at';

/** Bots fill every field; humans never see the honeypot (aria-hidden). */
export type BotCheckFailure = 'honeypot' | 'missing-timestamp' | 'too-fast' | 'stale';

/** Minimum human fill time. Bots typically submit in < 1s. */
const MIN_FILL_MS = 2000;
/** Stale-tab guard: a form left open for hours then submitted is suspicious. */
const MAX_FILL_MS = 6 * 60 * 60 * 1000;

/**
 * Returns null when the submission looks human, otherwise the failure reason.
 * Callers should return a GENERIC retry error (no `values` echo, so the form
 * does not remount and the user keeps their original timestamp on retry).
 */
export function botCheckFailed(formData: FormData): BotCheckFailure | null {
  const honeypot = formData.get(HONEYPOT_FIELD);
  if (typeof honeypot === 'string' && honeypot.trim() !== '') return 'honeypot';

  const startedRaw = formData.get(FORM_STARTED_FIELD);
  const started = Number(startedRaw);
  if (!startedRaw || !Number.isFinite(started) || started <= 0) return 'missing-timestamp';

  const age = Date.now() - started;
  if (age < MIN_FILL_MS) return 'too-fast';
  if (age > MAX_FILL_MS) return 'stale';
  return null;
}
