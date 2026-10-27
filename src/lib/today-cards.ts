import { deriveJobWindow, isJobLate } from './job-status.ts';

/**
 * Scroll lesson 4 — one card per job for the working day.
 *
 * Late jobs (not started, start passed) come first, earliest first, so
 * the pro sees overdue work before today's schedule; today's jobs follow
 * in start-time order. Completed work stays in place chronologically —
 * the day's record, not a filtered list. Cancelled jobs never appear.
 * Jobs with no computable start (time TBD, or date-only) sort last in
 * their group. `now` is injectable for tests.
 */

export interface TodayCardJob {
  id: string;
  date: Date;
  time: string | null;
  timeTbd: boolean;
  startAt: Date | null;
  endAt: Date | null;
  status: string;
}

export interface TodayCard {
  job: TodayCardJob;
  late: boolean;
}

function startKey(job: TodayCardJob): number {
  if (job.startAt) return job.startAt.getTime();
  if (job.timeTbd || !job.time) return Number.POSITIVE_INFINITY;
  const { startAt } = deriveJobWindow(job);
  return (startAt ?? job.date).getTime();
}

export function selectTodayCards(
  todayJobs: TodayCardJob[],
  pastJobs: TodayCardJob[],
  now: Date = new Date(),
  timezone: string = 'America/Toronto',
): TodayCard[] {
  const late = pastJobs
    .filter((j) => j.status !== 'CANCELLED' && isJobLate(j, now, timezone))
    .sort((a, b) => startKey(a) - startKey(b))
    .map((job) => ({ job, late: true }));
  const today = todayJobs
    .filter((j) => j.status !== 'CANCELLED')
    .sort((a, b) => startKey(a) - startKey(b))
    .map((job) => ({ job, late: false }));
  return [...late, ...today];
}
