/**
 * One-way Google Calendar sync: EveryJob jobs → Google Calendar events.
 *
 * Each synced event carries `extendedProperties.private.everyjobJobId`
 * (the EveryJob job id) plus `everyjobHash` (a fingerprint of the synced
 * fields), so sync is idempotent and needs no schema changes. On every run:
 *
 * - active jobs in the window without an event → create
 * - active jobs whose fingerprint changed → update
 * - events whose job was cancelled/deleted → delete
 *
 * Writing to a calendar requires the
 * `https://www.googleapis.com/auth/calendar` scope. Connections made before
 * that scope was requested only have `calendar.readonly` — sync detects the
 * missing scope and returns `{ ok: false, reason: 'needs-scope' }` so the UI
 * can ask the owner to reconnect, instead of failing. Missing connection,
 * missing OAuth config, or no refresh token degrade the same graceful way.
 *
 * Pure Calendar HTTP helpers (injectable fetch) run under plain node:test;
 * `syncJobsToGoogleCalendar` touches Prisma and is the cron entry point —
 * hook it in the cron route, e.g.:
 *
 *   // src/app/api/cron/workflows/route.ts, inside GET after the workflow loop:
 *   const { syncJobsToGoogleCalendar } = await import('@/lib/googleCalendarSync');
 *   for (const b of businessesWithGoogle) {
 *     await syncJobsToGoogleCalendar(b.id).catch(() => {});
 *   }
 */
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { refreshAccessToken } from '@/lib/google-reviews';
import {
  GOOGLE_CALENDAR_EVENTS_URL,
  type GoogleApiCalendarEvent,
} from '@/lib/google-calendar';
import { defaultTimezoneForRegion } from '@/lib/utils';

/** Write scope needed for create/update/delete. Readonly is not enough. */
export const SCOPE_CALENDAR_WRITE = 'https://www.googleapis.com/auth/calendar';
/** Private extended property linking a Google event back to its job. */
export const EVERYJOB_JOB_ID_PROP = 'everyjobJobId';
export const EVERYJOB_HASH_PROP = 'everyjobHash';

/** Sync window: 7 days back (catch late edits) → 90 days ahead. */
const SYNC_PAST_DAYS = 7;
const SYNC_FUTURE_DAYS = 90;
const DEFAULT_DURATION_MIN = 60;

type FetchImpl = typeof fetch;

/** Google event with the private extended properties we use for job linking. */
export type SyncedCalendarEvent = GoogleApiCalendarEvent & {
  extendedProperties?: { private?: Record<string, string> };
};

export type SyncOutcome =
  | { ok: true; created: number; updated: number; deleted: number; skipped: number }
  | { ok: false; reason: 'not-configured' | 'not-connected' | 'needs-scope' | 'no-refresh-token' | 'error'; message?: string };

type JobForSync = {
  id: string;
  title: string;
  date: Date;
  time: string | null;
  address: string | null;
  price: number;
  status: string;
  notes: string | null;
  technician: string | null;
  customer: { name: string } | null;
};

/* ------------------------------------------------------------------ */
/* Pure helpers (node:test friendly)                                   */
/* ------------------------------------------------------------------ */

/** Fingerprint of the fields we sync — stored on the event, compared to skip no-ops. Pure. */
export function fingerprintJobEvent(parts: {
  summary: string;
  startISO: string;
  endISO: string;
  location: string;
  description: string;
}): string {
  return createHash('sha256')
    .update([parts.summary, parts.startISO, parts.endISO, parts.location, parts.description].join('|'), 'utf8')
    .digest('hex')
    .slice(0, 32);
}

/** Build the Google event body for a job. Pure.
 *
 * The business timezone matters: `job.date` is stored as a UTC-midnight
 * calendar date, and `job.time` is wall-clock time in the business's zone.
 * We emit naive local ISO strings ("2026-09-25T09:00:00") and pass the
 * IANA `timeZone` alongside — Google interprets them in that zone. (The old
 * code called `setHours` on the server, which is UTC on Vercel, shifting
 * e.g. Toronto jobs 4–5 hours early.)
 */
export function jobToCalendarEvent(
  job: JobForSync,
  timeZone: string
): { summary: string; description: string; location: string; startISO: string; endISO: string; timeZone: string } {
  const customerName = job.customer?.name?.trim() || 'Customer';
  const summary = `${job.title} — ${customerName}`;
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/.test(job.time ?? '') ? job.time! : '09:00';
  const [hh, mm] = hhmm.split(':').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = job.date.getUTCFullYear();
  const mo = job.date.getUTCMonth() + 1;
  const d = job.date.getUTCDate();
  const startLocal = `${y}-${pad(mo)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00`;
  // End = start + duration, rolling over midnight correctly.
  const base = new Date(Date.UTC(y, mo - 1, d));
  base.setUTCDate(base.getUTCDate() + Math.floor((hh * 60 + mm + DEFAULT_DURATION_MIN) / 1440));
  const remMin = (hh * 60 + mm + DEFAULT_DURATION_MIN) % 1440;
  const endLocal = `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}T${pad(Math.floor(remMin / 60))}:${pad(remMin % 60)}:00`;
  const descLines = [
    `EveryJob job · ${job.status}`,
    `Customer: ${customerName}`,
    `Price: $${job.price.toFixed(2)}`,
    job.technician ? `Technician: ${job.technician}` : '',
    job.notes ? `Notes: ${job.notes.slice(0, 500)}` : '',
  ].filter(Boolean);
  return {
    summary: summary.slice(0, 200),
    description: descLines.join('\n'),
    location: (job.address ?? '').slice(0, 500),
    startISO: startLocal,
    endISO: endLocal,
    timeZone,
  };
}

/* ------------------------------------------------------------------ */
/* Calendar HTTP (fetch injected for tests)                             */
/* ------------------------------------------------------------------ */

async function authedFetch(
  accessToken: string,
  url: string,
  init: RequestInit,
  fetchImpl: FetchImpl
): Promise<Response> {
  return fetchImpl(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${accessToken}` },
  });
}

/** List events in the window that carry our job-link property. */
export async function listSyncedEvents(
  accessToken: string,
  timeMinISO: string,
  timeMaxISO: string,
  fetchImpl: FetchImpl = fetch
): Promise<SyncedCalendarEvent[]> {
  const q = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    maxResults: '100',
  });
  const res = await authedFetch(accessToken, `${GOOGLE_CALENDAR_EVENTS_URL}?${q.toString()}`, {}, fetchImpl);
  if (!res.ok) throw new Error(`Calendar list failed: ${res.status}`);
  const data = (await res.json()) as { items?: SyncedCalendarEvent[] };
  return (data.items ?? []).filter(
    (e) => e.status !== 'cancelled' && e.extendedProperties?.private?.[EVERYJOB_JOB_ID_PROP]
  );
}

export async function createCalendarEvent(
  accessToken: string,
  body: Record<string, unknown>,
  fetchImpl: FetchImpl = fetch
): Promise<string> {
  const res = await authedFetch(
    accessToken,
    GOOGLE_CALENDAR_EVENTS_URL,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    fetchImpl
  );
  if (!res.ok) throw new Error(`Calendar create failed: ${res.status}`);
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error('Calendar create returned no id');
  return data.id;
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  body: Record<string, unknown>,
  fetchImpl: FetchImpl = fetch
): Promise<void> {
  const res = await authedFetch(
    accessToken,
    `${GOOGLE_CALENDAR_EVENTS_URL}/${encodeURIComponent(eventId)}`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    fetchImpl
  );
  if (!res.ok) throw new Error(`Calendar update failed: ${res.status}`);
}

export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string,
  fetchImpl: FetchImpl = fetch
): Promise<void> {
  const res = await authedFetch(
    accessToken,
    `${GOOGLE_CALENDAR_EVENTS_URL}/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
    fetchImpl
  );
  // 410 Gone = already deleted — treat as success (idempotent).
  if (!res.ok && res.status !== 410) throw new Error(`Calendar delete failed: ${res.status}`);
}

/* ------------------------------------------------------------------ */
/* Orchestrator (Prisma + Google). Cron entry point.                    */
/* ------------------------------------------------------------------ */

function googleEnv(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function getWriteAccessToken(businessId: string): Promise<string> {
  const env = googleEnv();
  if (!env) throw Object.assign(new Error('Google OAuth not configured'), { kind: 'not-configured' });
  const conn = await prisma.googleConnection.findUnique({ where: { businessId } });
  if (!conn) throw Object.assign(new Error('Google not connected'), { kind: 'not-connected' });

  const granted = (conn.scopes ?? '').split(/\s+/).filter(Boolean);
  if (!granted.includes(SCOPE_CALENDAR_WRITE)) {
    throw Object.assign(new Error('Calendar write scope not granted — reconnect Google'), {
      kind: 'needs-scope',
    });
  }

  const stillValid = conn.expiresAt && conn.expiresAt.getTime() > Date.now() + 60_000;
  if (stillValid) return conn.accessToken;
  if (!conn.refreshToken) throw Object.assign(new Error('No refresh token'), { kind: 'no-refresh-token' });
  const refreshed = await refreshAccessToken(
    { clientId: env.clientId, clientSecret: env.clientSecret, refreshToken: conn.refreshToken },
    fetch
  );
  await prisma.googleConnection.update({
    where: { id: conn.id },
    data: { accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt },
  });
  return refreshed.accessToken;
}

/**
 * Sync one business's jobs to its Google Calendar. One-way: EveryJob is the
 * source of truth; edits made directly in Google are overwritten. Returns a
 * graceful `{ ok: false, reason }` instead of throwing for expected states.
 */
export async function syncJobsToGoogleCalendar(
  businessId: string,
  fetchImpl: FetchImpl = fetch
): Promise<SyncOutcome> {
  let accessToken: string;
  try {
    accessToken = await getWriteAccessToken(businessId);
  } catch (e) {
    const kind = (e as { kind?: string }).kind;
    if (kind === 'not-configured' || kind === 'not-connected' || kind === 'needs-scope' || kind === 'no-refresh-token') {
      return { ok: false, reason: kind };
    }
    return { ok: false, reason: 'error', message: (e as Error).message };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true, regionCode: true },
  });
  const timeZone = business?.timezone || defaultTimezoneForRegion(business?.regionCode);

  const now = new Date();
  const min = new Date(now.getTime() - SYNC_PAST_DAYS * 86_400_000);
  const max = new Date(now.getTime() + SYNC_FUTURE_DAYS * 86_400_000);

  const jobs = (await prisma.job.findMany({
    where: { businessId, date: { gte: min, lte: max } },
    select: {
      id: true, title: true, date: true, time: true, address: true,
      price: true, status: true, notes: true, technician: true,
      customer: { select: { name: true } },
    },
  })) as JobForSync[];

  const active = jobs.filter((j) => j.status !== 'CANCELLED');
  const activeIds = new Set(active.map((j) => j.id));

  let events: SyncedCalendarEvent[];
  try {
    events = await listSyncedEvents(accessToken, min.toISOString(), max.toISOString(), fetchImpl);
  } catch (e) {
    return { ok: false, reason: 'error', message: (e as Error).message };
  }
  const byJobId = new Map<string, SyncedCalendarEvent>();
  for (const e of events) {
    const jobId = e.extendedProperties?.private?.[EVERYJOB_JOB_ID_PROP];
    if (jobId && e.id) byJobId.set(jobId, e);
  }

  let created = 0, updated = 0, deleted = 0, skipped = 0;

  const buildBody = (job: JobForSync): Record<string, unknown> => {
    const ev = jobToCalendarEvent(job, timeZone);
    const hash = fingerprintJobEvent({ summary: ev.summary, startISO: ev.startISO, endISO: ev.endISO, location: ev.location, description: ev.description });
    return {
      summary: ev.summary,
      description: ev.description,
      location: ev.location || undefined,
      start: { dateTime: ev.startISO, timeZone },
      end: { dateTime: ev.endISO, timeZone },
      extendedProperties: {
        private: { [EVERYJOB_JOB_ID_PROP]: job.id, [EVERYJOB_HASH_PROP]: hash },
      },
    };
  };

  for (const job of active) {
    try {
      const existing = byJobId.get(job.id);
      const body = buildBody(job);
      const hash = (body.extendedProperties as { private: Record<string, string> }).private[EVERYJOB_HASH_PROP];
      if (!existing) {
        await createCalendarEvent(accessToken, body, fetchImpl);
        created++;
      } else if (existing.extendedProperties?.private?.[EVERYJOB_HASH_PROP] !== hash) {
        await updateCalendarEvent(accessToken, existing.id!, body, fetchImpl);
        updated++;
      } else {
        skipped++;
      }
    } catch {
      // One bad job must not abort the whole sync; it retries next run.
    }
  }

  for (const [jobId, event] of byJobId) {
    if (!activeIds.has(jobId) && event.id) {
      try {
        await deleteCalendarEvent(accessToken, event.id, fetchImpl);
        deleted++;
      } catch {
        /* retry next run */
      }
    }
  }

  await prisma.googleConnection.update({
    where: { businessId },
    data: { lastSyncAt: new Date() },
  }).catch(() => {});

  return { ok: true, created, updated, deleted, skipped };
}
