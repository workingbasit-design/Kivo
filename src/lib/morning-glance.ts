/**
 * Scroll lesson 6 — morning "Today at a glance": pure selection.
 *
 * The glance answers one question: what is the first thing still to do
 * today? Done (COMPLETED/PAID) and CANCELLED jobs never count as
 * upcoming; among the rest, the earliest start wins (startAt canonical,
 * date+time fallback via deriveJobWindow), and jobs with no usable time
 * sort last rather than first.
 */
import { deriveJobWindow } from "./job-status.ts";

export interface GlanceJob {
  id: string;
  title: string;
  time?: string | null;
  date?: Date | string | null;
  startAt?: Date | string | null;
  status: string;
}

const UPCOMING_STATUSES = ["NEW", "SCHEDULED", "IN PROGRESS"];

/** The first job still to do today, or null when nothing is upcoming. */
export function selectFirstUpcoming(jobs: GlanceJob[]): GlanceJob | null {
  const upcoming = jobs.filter((j) => UPCOMING_STATUSES.includes(j.status));
  upcoming.sort((a, b) => {
    const wa = deriveJobWindow(a).startAt?.getTime();
    const wb = deriveJobWindow(b).startAt?.getTime();
    if (wa == null && wb == null) return 0;
    if (wa == null) return 1;
    if (wb == null) return -1;
    return wa - wb;
  });
  return upcoming[0] ?? null;
}
