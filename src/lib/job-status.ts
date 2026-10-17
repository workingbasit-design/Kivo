/**
 * Canonical job status transition rules.
 *
 * Single source of truth for which status changes are legal. The server
 * action `updateJobStatus` enforces these; the UI imports
 * `validNextStatuses` so it only offers transitions the server will accept.
 *
 * Rules:
 *  - PIPELINE (NEW -> SCHEDULED -> IN PROGRESS -> COMPLETED -> PAID) moves
 *    forward freely, and ONE step backward (undo for a mistaken tap - e.g.
 *    COMPLETED -> IN PROGRESS). Jumping back multiple steps at once is
 *    rejected; tap "back" repeatedly instead.
 *  - CANCELLED is reachable from any status except PAID and CANCELLED.
 *  - A CANCELLED job can only be reopened as NEW or SCHEDULED.
 *  - Moving to the current status is a harmless no-op (allowed).
 */

export const JOB_PIPELINE = ['NEW', 'SCHEDULED', 'IN PROGRESS', 'COMPLETED', 'PAID'] as const;

export type JobStatus = (typeof JOB_PIPELINE)[number] | 'CANCELLED';

/** All known statuses, for UI selects. */
export const ALL_JOB_STATUSES: JobStatus[] = [...JOB_PIPELINE, 'CANCELLED'];

export function isValidTransition(from: string, to: string): boolean {
  if (from === to) return true;
  if (to === 'CANCELLED') return from !== 'PAID' && from !== 'CANCELLED';
  if (from === 'CANCELLED') return to === 'NEW' || to === 'SCHEDULED';
  const fi = (JOB_PIPELINE as readonly string[]).indexOf(from);
  const ti = (JOB_PIPELINE as readonly string[]).indexOf(to);
  if (fi === -1 || ti === -1) return false;
  // Forward any number of steps; backward exactly one step (mistake undo).
  return ti > fi || ti === fi - 1;
}

/**
 * The statuses a job in `current` may legally move to (excluding `current`
 * itself, which is always a no-op). Sorted: pipeline-forward moves first,
 * then the one-step-back undo, then CANCELLED last.
 */
export function validNextStatuses(current: string): string[] {
  return ALL_JOB_STATUSES.filter((s) => s !== current && isValidTransition(current, s));
}

/**
 * The single pipeline status a job in `current` can step back to, or null
 * when there is no earlier pipeline stage (NEW, CANCELLED).
 */
export function previousPipelineStatus(current: string): string | null {
  const i = (JOB_PIPELINE as readonly string[]).indexOf(current);
  return i > 0 ? JOB_PIPELINE[i - 1] : null;
}

/* ------------------------------------------------------------------ */
/* Part A1: canonical lifecycle display (added 2026-10-14).             */
/*                                                                     */
/* Stored status values use the legacy spellings ('IN PROGRESS' with a */
/* space). Do NOT rename a stored value without a data migration.      */
/* ------------------------------------------------------------------ */

import { toISODateInTimezone } from './utils.ts';

/**
 * Canonical job statuses in the one fixed filter order used everywhere
 * (Jobs list, Schedule, Dashboard). Same values as ALL_JOB_STATUSES.
 */
export const JOB_STATUSES: readonly JobStatus[] = ALL_JOB_STATUSES;

/** Statuses that count as "not started" for the Late rule: a job that has
 *  begun (IN PROGRESS) is never Late. Reversed 2026-10-17 by the owner:
 *  the 2026-10-15 "Everywhere" decision (BUG-P4-001) treated in-progress
 *  past-due work as Late; the standing rule is now: Late = not started AND
 *  the start time has passed. In-progress work past its end time is
 *  "Running over" (see isRunningOver). */
const LATE_ELIGIBLE_STATUSES: readonly string[] = ['NEW', 'SCHEDULED'];

const JOB_STATUS_LABELS_EN: Record<string, string> = {
  NEW: 'New',
  SCHEDULED: 'Scheduled',
  'IN PROGRESS': 'In progress',
  COMPLETED: 'Completed',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

const JOB_STATUS_LABELS_FR: Record<string, string> = {
  NEW: 'Nouveau',
  SCHEDULED: 'Planifié',
  'IN PROGRESS': 'En cours',
  COMPLETED: 'Terminé',
  PAID: 'Payé',
  CANCELLED: 'Annulé',
};

/** Sentence-case display label for a stored job status. Never show raw
 *  SCREAMING_CASE to users. */
export function jobStatusLabel(status: string, locale: 'en' | 'fr' = 'en'): string {
  const dict = locale === 'fr' ? JOB_STATUS_LABELS_FR : JOB_STATUS_LABELS_EN;
  const hit = dict[status];
  if (hit) return hit;
  return status.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * True when a job has not started (status New or Scheduled) and its start
 * time has passed. Late is derived, never stored.
 *
 * Start-time precision: when the job has a canonical `startAt`, it is Late
 * the moment that instant passes (a 9:00 a.m. job unstarted at 10:00 a.m.
 * is Late, even though its calendar day is today). Without `startAt`, the
 * calendar-day fallback applies: a job whose `date` is before today in the
 * business's IANA timezone is Late; a job due today is not.
 *
 * Uses the business timezone (not server UTC) so a job dated "today" can't
 * flip Late in the evening when UTC has already rolled to tomorrow.
 */
export function isJobLate(
  job: {
    date: Date | string | null | undefined;
    startAt?: Date | string | null | undefined;
    status: string;
  },
  now: Date = new Date(),
  timezone: string = 'America/Toronto',
): boolean {
  if (!LATE_ELIGIBLE_STATUSES.includes(job.status)) return false;
  const start = toValidDate(job.startAt);
  if (start) return start.getTime() < now.getTime();
  if (!job.date) return false;
  const day = toDayKey(job.date, timezone);
  if (!day) return false;
  const todayDay = toISODateInTimezone(now, timezone);
  return day < todayDay;
}

/** A value that is a real Date instant, or null when missing/invalid. */
function toValidDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Calendar-day key (YYYY-MM-DD) for a date value, or null when invalid. */
function toDayKey(v: Date | string, timezone: string): string | null {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    // "YYYY-MM-DD" is already a calendar day - use it directly.
    return v.slice(0, 10);
  }
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return toISODateInTimezone(d, timezone);
}

/**
 * True when a job is IN PROGRESS and its end time has passed. A job in
 * progress is never "Late" (standing owner rule, 2026-10-17); it is
 * "Running over" instead. Requires an `endAt` — without a scheduled end
 * there is nothing to run over.
 */
export function isRunningOver(
  job: {
    status: string;
    endAt?: Date | string | null | undefined;
  },
  now: Date = new Date(),
): boolean {
  if (job.status !== 'IN PROGRESS') return false;
  const end = toValidDate(job.endAt);
  if (!end) return false;
  return end.getTime() < now.getTime();
}

/** Re-exported so call sites have one import location for status display. */
export { formatStatusLabel } from './utils.ts';
