/**
 * Canonical job status transition rules.
 *
 * Single source of truth for which status changes are legal. The server
 * action `updateJobStatus` enforces these; the UI imports
 * `validNextStatuses` so it only offers transitions the server will accept.
 *
 * Rules:
 *  - PIPELINE (NEW -> SCHEDULED -> IN PROGRESS -> COMPLETED -> PAID) is
 *    forward-only; backward moves are rejected.
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
  return ti > fi; // forward only, never backwards
}

/**
 * The statuses a job in `current` may legally move to (excluding `current`
 * itself, which is always a no-op). Sorted: pipeline-forward moves first,
 * then CANCELLED last.
 */
export function validNextStatuses(current: string): string[] {
  return ALL_JOB_STATUSES.filter((s) => s !== current && isValidTransition(current, s));
}
