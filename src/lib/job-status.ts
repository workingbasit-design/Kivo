/**
 * Canonical job status transition rules.
 *
 * Single source of truth for which status changes are legal. The server
 * action `updateJobStatus` enforces these; the UI imports
 * `validNextStatuses` so it only offers transitions the server will accept.
 *
 * Rules:
 *  - PIPELINE (NEW -> SCHEDULED -> IN PROGRESS -> COMPLETED -> PAID) moves
 *    forward freely, and ONE step backward (undo for a mistaken tap — e.g.
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

/** Statuses for which a past-due date renders the Late badge. Late is
 *  derived, never stored: a job is Late when its scheduled start is before
 *  today in the business's time zone and its status is New or Scheduled. */
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
 * True when a job's date is before today (in the given IANA timezone) and
 * its status is New or Scheduled. Calendar-day comparison: a job due today
 * is not late; a job due yesterday or earlier with an open status is.
 *
 * Uses the business timezone (not server UTC) so a job dated "today" can't
 * flip Late in the evening when UTC has already rolled to tomorrow.
 */
export function isJobLate(
  job: { date: Date | string | null | undefined; status: string },
  now: Date = new Date(),
  timezone: string = 'America/Toronto',
): boolean {
  if (!job.date) return false;
  if (!LATE_ELIGIBLE_STATUSES.includes(job.status)) return false;
  let day: string;
  if (job.date instanceof Date) {
    if (Number.isNaN(job.date.getTime())) return false;
    day = toISODateInTimezone(job.date, timezone);
  } else if (/^\d{4}-\d{2}-\d{2}/.test(job.date)) {
    // "YYYY-MM-DD" is already a calendar day — use it directly.
    day = job.date.slice(0, 10);
  } else {
    const d = new Date(job.date);
    if (Number.isNaN(d.getTime())) return false;
    day = toISODateInTimezone(d, timezone);
  }
  const todayDay = toISODateInTimezone(now, timezone);
  return day < todayDay;
}

/** Re-exported so call sites have one import location for status display. */
export { formatStatusLabel } from './utils.ts';
