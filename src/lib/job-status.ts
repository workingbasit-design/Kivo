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
