/**
 * Track 9 — messaging quota guardrails (free-tier hard limits).
 *
 * Pure, testable TypeScript: no DB, no network, no Next.js imports.
 *
 * Verified free-tier limits (research 2026-09-23):
 * - WhatsApp: Meta allows 1,000 free *service messages* per calendar month per
 *   business phone number (Meta admin email 2026-09-05; per-message pricing
 *   from 2026-10-01). Business-initiated utility templates are PAID per
 *   message — EveryJob never sends those; we send free-form service text,
 *   which Meta delivers free inside an open 24h customer-service window or
 *   rejects (template_required), in which case we fall back to email.
 * - Email (Resend free tier): 3,000/month AND 100/day — the daily cap is the
 *   binding constraint (resend.com/pricing; resend.com/docs/knowledge-base/
 *   account-quotas-and-limits). Exceeding either pauses sending.
 * - SMS: no genuine ongoing free tier exists (trial credits only) — disabled.
 */

export interface QuotaLimits {
  whatsapp: number;
  email: number;
  emailDaily: number;
}

/** Verified defaults — overridable per business in MessagingSettings. */
export const VERIFIED_QUOTA_DEFAULTS = {
  whatsappMonthly: 1000,
  emailMonthly: 3000,
  emailDaily: 100,
} as const;

/**
 * "YYYY-MM" of the date in the given IANA timezone (e.g. a usage
 * counter that rolls over on the business-local month boundary).
 */
export function monthKeyInTimezone(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}`;
}

/** "YYYY-MM-DD" of the date in the given IANA timezone (daily email cap). */
export function dayKeyInTimezone(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** True while the channel still has quota left: used < limit. */
export function quotaAllows(used: number, limit: number): boolean {
  return used < limit;
}

/** Remaining quota, floored at 0. */
export function quotaRemaining(used: number, limit: number): number {
  return Math.max(0, limit - used);
}

/** Percentage of quota consumed, 0..100 rounded; 0 when limit <= 0. */
export function quotaPercentUsed(used: number, limit: number): number {
  if (limit <= 0) return 0;
  const pct = Math.round((used / limit) * 100);
  return Math.min(100, Math.max(0, pct));
}
