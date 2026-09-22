/**
 * Working-hours helpers for Business.workingHours.
 *
 * Storage format (JSON string on the Business row):
 *   {"mon":["09:00","18:00"],"tue":["09:00","18:00"], ...}
 * A day key is absent (or null) when the business is closed that day.
 * Times are 24-hour "HH:MM" local to the business.
 *
 * Day keys: mon tue wed thu fri sat sun.
 */

export const WEEK_DAYS = [
  { key: 'mon', label: 'Monday', short: 'Mon' },
  { key: 'tue', label: 'Tuesday', short: 'Tue' },
  { key: 'wed', label: 'Wednesday', short: 'Wed' },
  { key: 'thu', label: 'Thursday', short: 'Thu' },
  { key: 'fri', label: 'Friday', short: 'Fri' },
  { key: 'sat', label: 'Saturday', short: 'Sat' },
  { key: 'sun', label: 'Sunday', short: 'Sun' },
] as const;

export type DayKey = (typeof WEEK_DAYS)[number]['key'];
export type DayHours = [string, string] | null;
export type WorkingHours = Partial<Record<DayKey, DayHours>>;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(v: string): boolean {
  return TIME_RE.test(v);
}

/** Parse the stored JSON string. Returns null when not configured/invalid. */
export function parseWorkingHours(raw: string | null | undefined): WorkingHours | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const out: WorkingHours = {};
    const keys = new Set(WEEK_DAYS.map((d) => d.key));
    for (const [k, v] of Object.entries(parsed)) {
      if (!keys.has(k as DayKey)) continue;
      if (v === null || v === undefined) continue;
      if (
        Array.isArray(v) &&
        v.length === 2 &&
        typeof v[0] === 'string' &&
        typeof v[1] === 'string' &&
        isValidTime(v[0]) &&
        isValidTime(v[1]) &&
        v[0] < v[1]
      ) {
        out[k as DayKey] = [v[0], v[1]];
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

/** Serialize a WorkingHours map for storage. */
export function serializeWorkingHours(hours: WorkingHours): string {
  const out: Record<string, [string, string]> = {};
  for (const d of WEEK_DAYS) {
    const h = hours[d.key];
    if (h) out[d.key] = h;
  }
  return JSON.stringify(out);
}

function to12h(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/**
 * Human summary for display, e.g. "Mon–Fri · 9:00 AM – 6:00 PM" or
 * "Mon, Wed, Sat · 10:00 AM – 4:00 PM". Returns null when not configured.
 */
export function formatWorkingHoursSummary(raw: string | null | undefined): string | null {
  const hours = parseWorkingHours(raw);
  if (!hours) return null;
  // Group consecutive days with identical hours.
  const groups: { days: string[]; open: string; close: string }[] = [];
  for (const d of WEEK_DAYS) {
    const h = hours[d.key];
    if (!h) continue;
    const last = groups[groups.length - 1];
    if (last && last.open === h[0] && last.close === h[1]) {
      last.days.push(d.short);
    } else {
      groups.push({ days: [d.short], open: h[0], close: h[1] });
    }
  }
  if (groups.length === 0) return null;
  return groups
    .map((g) => {
      const dayLabel =
        g.days.length > 2
          ? `${g.days[0]}–${g.days[g.days.length - 1]}`
          : g.days.join(', ');
      return `${dayLabel} · ${to12h(g.open)} – ${to12h(g.close)}`;
    })
    .join('  ·  ');
}

/**
 * Is the business open at the given local date/time? Used by slot logic to
 * skip days outside working hours. Unknown/unconfigured hours => true
 * (don't block booking when the business never set hours).
 */
export function isOpenAt(
  raw: string | null | undefined,
  at: Date
): boolean {
  const hours = parseWorkingHours(raw);
  if (!hours) return true;
  // JS: 0=Sun..6=Sat -> our keys
  const key = (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[at.getDay()];
  const h = hours[key];
  if (!h) return false;
  const hh = String(at.getHours()).padStart(2, '0');
  const mm = String(at.getMinutes()).padStart(2, '0');
  const t = `${hh}:${mm}`;
  return t >= h[0] && t < h[1];
}
