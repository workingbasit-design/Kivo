/**
 * Slice 5: quote expiry. Expiry is DERIVED, not a status — no EXPIRED
 * status, no cron. A quote is expired only while it is SENT with a past
 * expiresAt; drafts are inert (a draft isn't out in the world) and the
 * pro can always convert or extend an expired quote.
 *
 * "Valid until Nov 15" means THROUGH Nov 15, so expiresAt is stored as
 * end-of-day in the business timezone (23:59:59.999), never midnight —
 * a midnight store would wrongly block a Nov-15-afternoon acceptance.
 */

import { parseDateInputInTimezone } from './utils.ts';

/** Strict YYYY-MM-DD check (rejects 2026-02-30, which Date.UTC rolls over). */
export function isValidDateKey(key: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d <= daysInMonth;
}

function nextDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  const p = (v: number) => String(v).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/** End of the given business-tz day (1ms before the next day's midnight). */
export function expiryEndOfDay(
  dateKey: string,
  timeZone?: string | null
): Date {
  const nextMidnight = parseDateInputInTimezone(nextDayKey(dateKey), timeZone);
  return new Date(nextMidnight.getTime() - 1);
}

/** True only for SENT quotes whose validity has passed. */
export function isQuoteExpired(
  quote: { status: string; expiresAt: Date | null | undefined },
  now: Date = new Date()
): boolean {
  return (
    quote.status === 'SENT' &&
    quote.expiresAt != null &&
    now.getTime() > quote.expiresAt.getTime()
  );
}
