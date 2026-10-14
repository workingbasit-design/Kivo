import { getDictionary } from './i18n/index.ts';

/** Join class names, dropping falsy values. */
export function cn(
  ...inputs: Array<string | false | null | undefined>
): string {
  return inputs.filter(Boolean).join(" ");
}

/**
 * Whether a job's stored `time` counts as a real scheduled time.
 *
 * Jobs booked through Copilot before the TBD-sentinel fix stored the literal
 * display string "TBD" in the `time` column instead of NULL. Treat that
 * (and blanks) as "no time set" everywhere we display or edit the time,
 * so the sentinel never leaks into inputs, badges or WhatsApp messages.
 */
export function hasJobTime(time: string | null | undefined): time is string {
  if (!time) return false;
  const t = time.trim();
  return t !== "" && t.toUpperCase() !== "TBD";
}

/**
 * Normalize a user-entered time to 24-hour "HH:MM" for storage.
 *
 * Accepts "10:00 AM", "10:00AM", "2pm", "2:30 pm", "09:00", "9:00", "21:30".
 * Returns null for blank/TBD/unparseable input - never stores garbage.
 * All job writes go through this so the column holds one canonical format.
 */
export function normalizeJobTime(input: string | null | undefined): string | null {
  if (!hasJobTime(input)) return null;
  const t = input!.trim().toUpperCase().replace(/\s+/g, ' ');
  // 24h "HH:MM" or "H:MM"
  let m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(t);
  if (m) {
    return `${m[1].padStart(2, '0')}:${m[2]}`;
  }
  // 12h with AM/PM: "10:00 AM", "2 PM", "2:30pm"
  m = /^(\d{1,2})(?::([0-5]\d))?\s*(AM|PM|A\.M\.|P\.M\.)$/.exec(t);
  if (m) {
    let h = parseInt(m[1], 10);
    if (h < 1 || h > 12) return null;
    const min = m[2] ?? '00';
    if (m[3].startsWith('P') && h !== 12) h += 12;
    if (m[3].startsWith('A') && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}`;
  }
  return null;
}

/**
 * Display a stored "HH:MM" time for a locale.
 * en → "10:00 AM" (12h, familiar to most Canadians); fr → "10 h 00".
 * Falls back to the raw value when it isn't in canonical form (legacy data).
 */
export function formatJobTime(
  time: string | null | undefined,
  locale: 'en' | 'fr' = 'en'
): string {
  if (!hasJobTime(time)) return '';
  const t = time!.trim();
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t);
  if (!m) return t; // legacy free text - show as-is rather than blanking
  const h24 = parseInt(m[1], 10);
  if (locale === 'fr') {
    return `${h24} h ${m[2]}`;
  }
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

/** Human-readable job status label. Stored values are SCREAMING_CASE;
 *  users see "In progress" / "En cours". */
const JOB_STATUS_LABELS: Record<string, { en: string; fr: string }> = {
  NEW: { en: 'New', fr: 'Nouveau' },
  SCHEDULED: { en: 'Scheduled', fr: 'Planifié' },
  'IN PROGRESS': { en: 'In progress', fr: 'En cours' },
  COMPLETED: { en: 'Completed', fr: 'Terminé' },
  PAID: { en: 'Paid', fr: 'Payé' },
  CANCELLED: { en: 'Cancelled', fr: 'Annulé' },
  LATE: { en: 'Late', fr: 'En retard' },
};

export function formatStatusLabel(status: string, locale: 'en' | 'fr' = 'en'): string {
  const entry = JOB_STATUS_LABELS[status];
  if (entry) return locale === 'fr' ? entry.fr : entry.en;
  // Fallback: title-case the raw value.
  return status.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Date locale for a business region: en-CA (Canada-only). */
export function dateLocaleForRegion(_regionCode?: string | null): string {
  return 'en-CA';
}

/** Map an app locale ('en' | 'fr') to a full date locale tag. */
export function localeDateTag(locale: string): string {
  return locale === 'fr' ? 'fr-CA' : 'en-CA';
}

/** Map an app locale ('en' | 'fr') to a money-format locale tag. */
export function localeMoneyTag(locale: string): 'en' | 'fr' {
  return locale === 'fr' ? 'fr' : 'en';
}

/** Format a Date/string as "Mon, Jan 5, 2026" */
export function formatDateLabel(
  dateInput: Date | string | null | undefined,
  locale: string = 'en-CA'
): string {
  if (!dateInput) return "-";
  let d: Date;
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    // Date-only strings: parse as LOCAL date, not UTC midnight (avoids
    // showing the previous day in timezones behind UTC).
    const [y, m, day] = dateInput.slice(0, 10).split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(dateInput);
  }
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format a Date/string as "5 Jan 2026" */
export function formatDateShort(
  dateInput: Date | string | null | undefined,
  locale: string = 'en-CA'
): string {
  if (!dateInput) return "-";
  let d: Date;
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    // Date-only strings: parse as LOCAL date, not UTC midnight (avoids
    // showing the previous day in timezones behind UTC).
    const [y, m, day] = dateInput.slice(0, 10).split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(dateInput);
  }
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "YYYY-MM-DD" in a specific IANA timezone (e.g. "America/Toronto"). */
export function toISODateInTimezone(d: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return toISODateLocal(d);
  }
}

/** Default IANA timezone for a region (used when the business has none set). */
export function defaultTimezoneForRegion(_regionCode?: string | null): string {
  return 'America/Toronto';
}

/** "YYYY-MM-DD" for "today" in the business's timezone. */
export function todayInTimezone(timeZone?: string | null, regionCode?: string | null): string {
  return toISODateInTimezone(new Date(), timeZone || defaultTimezoneForRegion(regionCode));
}

/** "YYYY-MM-DD" in local time (safe for <input type="date"> and day comparisons) */
export function toISODateLocal(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Start/end of a local day as Dates (for Prisma day-range queries) */
export function dayRange(dateStr: string): { gte: Date; lte: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const gte = new Date(y, m - 1, d, 0, 0, 0, 0);
  const lte = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { gte, lte };
}

/** Status -> badge color classes */
export function statusClasses(status: string): string {
  switch (status) {
    case 'LATE':
      // Computed display state (see jobDisplayStatus): past-due and still
      // open. Loud red so it can't be missed on a phone screen.
      return 'bg-red-100 text-red-800 border-red-300';
    case "IN PROGRESS":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "SCHEDULED":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "COMPLETED":
    case "PAID":
    case "APPROVED":
    case "CONVERTED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "UNPAID":
    case "NEW":
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
    case "CANCELLED":
    case "DECLINED":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "SENT":
    case "CONTACTED":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "PARTIALLY PAID":
    case "DRAFT":
      return "bg-orange-50 text-orange-700 border-orange-200";
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
  }
}

/** Job statuses that count as "still open" for overdue computation. */
export const OPEN_JOB_STATUSES = ['NEW', 'SCHEDULED', 'IN PROGRESS'] as const;

/**
 * Localized status label (job / invoice / quote / lead badges). Falls back
 * to the raw status string for values not yet translated, so no badge ever
 * renders a raw i18n key path.
 */
export function statusLabel(status: string, locale: 'en' | 'fr' = 'en'): string {
  const dict = getDictionary(locale) as unknown as { statuses?: Record<string, string> };
  return dict.statuses?.[status] ?? status;
}

/**
 * True when a job's date has passed and it still isn't done/cancelled.
 * Compares calendar days in the given IANA timezone: a job due today is
 * not overdue; a job due yesterday or earlier with an open status is.
 *
 * The timezone parameter fixes the server-UTC bug where a job dated
 * "today" would flip overdue in the evening once UTC rolled to tomorrow.
 * Defaults to America/Toronto (Canada-only app); pass the business's
 * timezone when known.
 */
export function isJobOverdue(
  status: string,
  date: Date | string | null | undefined,
  now: Date = new Date(),
  timezone: string = 'America/Toronto',
): boolean {
  if (!date) return false;
  if (!(OPEN_JOB_STATUSES as readonly string[]).includes(status)) return false;
  let day: string;
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) return false;
    day = toISODateInTimezone(date, timezone);
  } else if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
    // "YYYY-MM-DD" (or ISO with time): already a calendar day - use it
    // directly so "today" isn't off by one in the evening.
    day = date.slice(0, 10);
  } else {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return false;
    day = toISODateInTimezone(d, timezone);
  }
  const todayDay = toISODateInTimezone(now, timezone);
  return day < todayDay;
}

/**
 * Display label for a job status badge: 'LATE' when the date has passed
 * and the job is still open, otherwise the stored status. Display-only -
 * the stored status is never rewritten, so the badge auto-heals when the
 * date moves or the job is completed/cancelled. (2026-09-26: users reported
 * that past-due jobs never changed status.)
 */
export function jobDisplayStatus(
  status: string,
  date: Date | string | null | undefined,
  now?: Date,
  timezone: string = 'America/Toronto',
): string {
  return isJobOverdue(status, date, now, timezone) ? 'LATE' : status;
}
