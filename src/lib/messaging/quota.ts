/**
 * Track 9 — messaging quota guardrails (free-tier hard limits).
 *
 * Pure, testable TypeScript: no DB, no network, no Next.js imports.
 *
 * Verified free-tier limits (official sources, research 2026-09-23):
 * - WhatsApp: Meta grants 1,000 free *delivered service messages* per calendar
 *   month per business phone number, effective 2026-10-01; unused messages do
 *   not roll over and billing starts at the 1,001st at the market's per-message
 *   utility/authentication rate. Without a payment method on file Meta simply
 *   stops delivering after the free tier.
 *   Source: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
 *   Business-initiated utility templates are PAID per message — EveryJob never
 *   sends those; we send free-form service text, which Meta delivers inside an
 *   open 24h customer-service window (within the free tier) or rejects
 *   (template_required), in which case we fall back to email. Our own counter
 *   hard-stops at 1,000 so the paid tier is never reached.
 * - Email (Resend free-forever plan): 3,000/month AND 100/day — the daily cap
 *   is the binding constraint (https://resend.com/pricing;
 *   https://resend.com/docs/knowledge-base/account-quotas-and-limits).
 *   Exceeding either pauses sending.
 * - SMS: no genuine ongoing free tier exists (Twilio: one-time $15 trial
 *   credit, verified numbers only; Textbelt: 1 free text/day test courtesy) —
 *   disabled by design.
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
