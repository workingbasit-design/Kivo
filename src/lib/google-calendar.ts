/**
 * Pure Google Calendar helpers (Track 6B: calendar import).
 *
 * No Next.js imports — runs under plain node:test. HTTP is injected so
 * tests use mocked fetch; the server actions pass the real fetch.
 *
 * Endpoint: GET https://www.googleapis.com/calendar/v3/calendars/primary/events
 *   with singleEvents=true&orderBy=startTime&timeMin=..&timeMax=..&maxResults=100
 */

export const GOOGLE_CALENDAR_EVENTS_URL =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export const SCOPE_CALENDAR_READONLY = 'https://www.googleapis.com/auth/calendar.readonly';

export type GoogleApiCalendarEvent = {
  id?: string;
  status?: string; // 'confirmed' | 'cancelled' | 'tentative'
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export type CalendarDraft = {
  googleEventId: string;
  title: string;
  startISO: string;
  endISO: string | null;
  description: string | null;
  location: string | null;
};

type FetchImpl = typeof fetch;

function toISO(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Map one Google Calendar event to an import draft.
 * Returns null for cancelled events, events with no id, or events with no
 * (or unparseable) start — we never invent a schedule for a job draft.
 * All-day events (start.date, e.g. "2026-10-01") are kept: they become
 * midnight-UTC starts, still explicit about what Google gave us.
 */
export function mapCalendarEvent(e: GoogleApiCalendarEvent): CalendarDraft | null {
  if (!e || e.status === 'cancelled') return null;
  const googleEventId = (e.id ?? '').trim();
  const startISO = toISO(e.start?.dateTime ?? e.start?.date);
  if (!googleEventId || !startISO) return null;
  return {
    googleEventId,
    title: (e.summary ?? '').trim() || 'Untitled event',
    startISO,
    endISO: toISO(e.end?.dateTime ?? e.end?.date),
    description: (e.description ?? '').trim() || null,
    location: (e.location ?? '').trim() || null,
  };
}

/**
 * Fetch events in [timeMinISO, timeMaxISO] from the user's primary calendar.
 * Follows nextPageToken, capped at 5 pages to bound API cost.
 * Throws a classified error (kind) on HTTP failure so callers can map it.
 */
export async function fetchCalendarEvents(
  accessToken: string,
  timeMinISO: string,
  timeMaxISO: string,
  fetchImpl: FetchImpl = fetch
): Promise<GoogleApiCalendarEvent[]> {
  const all: GoogleApiCalendarEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const q = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      maxResults: '100',
    });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await fetchImpl(`${GOOGLE_CALENDAR_EVENTS_URL}?${q.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const err = new Error(`Calendar fetch failed: ${res.status}`) as Error & { kind: string };
      err.kind =
        res.status === 401 ? 'reauth' : res.status === 403 ? 'forbidden' : res.status === 429 ? 'rate_limited' : 'unknown';
      throw err;
    }
    const data = (await res.json()) as {
      items?: GoogleApiCalendarEvent[];
      nextPageToken?: string;
    };
    all.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return all;
}

/* ------------------------------------------------------------------ */
/* Business-local day/time for imported events                         */
/* ------------------------------------------------------------------ */

/** "YYYY-MM-DD" in a specific IANA timezone (no Next.js imports — pure). */
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
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
}

/**
 * Business-local day + HH:MM for a UTC instant. Calendar events arrive in
 * UTC; storing them in UTC would shift jobs by hours for Canadian shops.
 */
export function zonedDayAndTime(d: Date, timeZone: string): { day: string; hhmm: string } {
  const day = toISODateInTimezone(d, timeZone);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return { day, hhmm: `${get('hour').padStart(2, '0')}:${get('minute').padStart(2, '0')}` };
  } catch {
    return {
      day,
      hhmm: `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`,
    };
  }
}

/** "YYYY-MM-DD" → server-local-midnight Date, matching the app's job.date convention. */
export function localMidnight(dayStr: string): Date {
  const [y, m, dd] = dayStr.split('-').map(Number);
  return new Date(y, m - 1, dd, 0, 0, 0, 0);
}
