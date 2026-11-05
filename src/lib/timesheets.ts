import {
  parseDateInputInTimezone,
  dayRangeInTimezone,
  toISODateInTimezone,
} from './utils.ts';

/** Minutes between clock-in and clock-out (or now for an active session). */
export function entryMinutes(
  clockIn: Date | string,
  clockOut: Date | string | null,
  now: number = Date.now()
): number {
  const start = new Date(clockIn).getTime();
  const end = clockOut ? new Date(clockOut).getTime() : now;
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / 60000);
}

/** 150 -> "2h 30m", 45 -> "45m", 0 -> "0m" */
export function formatDuration(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Start of day N days ago (local time). */
export function startOfDayDaysAgo(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * 'YYYY-MM-DD' -> start-of-day Date, or null if invalid.
 * 2026-11-05: optional business timeZone. Without it, server-local
 * midnight (UTC on Vercel) — the evening "tomorrow" bug. With it, midnight
 * in the business timezone, so filter windows and displayed dates agree.
 */
export function parseDateStart(dateStr: string | undefined, timeZone?: string | null): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  if (timeZone) return parseDateInputInTimezone(dateStr, timeZone);
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** 'YYYY-MM-DD' -> end-of-day Date, or null if invalid. */
export function parseDateEnd(dateStr: string | undefined, timeZone?: string | null): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  if (timeZone) return dayRangeInTimezone(dateStr, timeZone).lte;
  const start = parseDateStart(dateStr);
  if (!start) return null;
  start.setHours(23, 59, 59, 999);
  return start;
}

/** 'YYYY-MM-DD' in local time for <input type="date"> defaults. */
export function toDateInputValue(d: Date, timeZone?: string | null): string {
  if (timeZone) return toISODateInTimezone(d, timeZone);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Shift a 'YYYY-MM-DD' calendar day by N days (pure calendar math). */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
