import { prisma } from '@/lib/prisma';
import { RECURRING_FREQUENCIES } from '@/lib/validations';
import { toISODateInTimezone, defaultTimezoneForRegion } from '@/lib/utils';

export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

/** Human label for a frequency value. */
export function frequencyLabel(frequency: string): string {
  switch (frequency) {
    case 'WEEKLY':
      return 'Every week';
    case 'BIWEEKLY':
      return 'Every 2 weeks';
    case 'MONTHLY':
      return 'Every month';
    default:
      return frequency;
  }
}

/** Advance a date by one frequency step. */
export function advanceNextRun(from: Date, frequency: string): Date {
  const d = new Date(from);
  if (frequency === 'WEEKLY') {
    d.setDate(d.getDate() + 7);
  } else if (frequency === 'BIWEEKLY') {
    d.setDate(d.getDate() + 14);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

/**
 * Business-local day window [gte, lt) containing an occurrence instant.
 * Pure and unit-testable; used by the generation dedupe check so a plan
 * occurrence near midnight buckets to the day the owner sees.
 */
export function occurrenceDayWindow(
  occurredAt: Date,
  timeZone: string
): { gte: Date; lt: Date } {
  const dayStr = toISODateInTimezone(occurredAt, timeZone);
  const gte = new Date(`${dayStr}T00:00:00`);
  const lt = new Date(gte);
  lt.setDate(lt.getDate() + 1);
  return { gte, lt };
}

/**
 * In-process per-business mutex for generation.
 *
 * This app is single-instance (SQLite) — see the same assumption in
 * src/lib/rate-limit.ts — so serializing concurrent generations inside this
 * process removes SQLite write-transaction contention (P2028 timeouts)
 * between parallel requests entirely. The DB transaction in
 * generateDueJobsInner remains the correctness backstop for anything
 * outside this process.
 */
const generationLocks = new Map<string, Promise<void>>();

async function withGenerationLock<T>(
  businessId: string,
  fn: () => Promise<T>
): Promise<T> {
  const prev = generationLocks.get(businessId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((res) => {
    release = res;
  });
  // Chain onto the previous holder; .catch keeps the chain alive even if a
  // previous generation threw.
  const chained = prev.catch(() => {}).then(() => gate);
  generationLocks.set(businessId, chained);
  await prev.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (generationLocks.get(businessId) === chained) {
      generationLocks.delete(businessId);
    }
  }
}

/**
 * Generate jobs for every active recurring job whose nextRun is due
 * (nextRun <= now). Creates one SCHEDULED Job per due recurring job and
 * advances nextRun by one frequency step.
 *
 * Deliberately generates at most ONE job per recurring job per call, so a
 * long-overdue plan can't flood the schedule — the next load/generation
 * catches up one more occurrence.
 *
 * IDEMPOTENCY (two layers):
 * 1. In-process mutex (withGenerationLock): concurrent generations for the
 *    same business are serialized, so the read-check-create-advance sequence
 *    below never overlaps with itself in this process.
 * 2. Per-plan write transaction: (1) re-reads the plan and confirms it's
 *    still due, (2) checks for an existing job on that day, (3) creates the
 *    job only if absent, and (4) advances nextRun — atomically. This is the
 *    backstop for anything outside this process.
 *
 * NOTE: there is deliberately no DB-level unique constraint — schema.prisma
 * is owned by another workstream. The transaction above is the enforcement.
 * The recommended belt-and-braces addition is:
 *   @@unique([recurringJobId, date])   on the Job model
 * (Job.date is set to the plan's nextRun, so one occurrence == one date.)
 *
 * Tenant-isolated: everything is scoped to businessId.
 */
export async function generateDueJobs(
  businessId: string
): Promise<{ created: number }> {
  // Serialize concurrent generations in-process (see withGenerationLock);
  // the per-plan transaction inside remains the cross-process backstop.
  return withGenerationLock(businessId, () => generateDueJobsInner(businessId));
}

async function generateDueJobsInner(
  businessId: string
): Promise<{ created: number }> {
  const now = new Date();
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true, regionCode: true },
  });
  // Business-timezone aware: the dedupe day-window below is computed in the
  // business's own timezone so a plan occurrence near midnight buckets to
  // the day the owner actually sees on their schedule.
  const timeZone = business?.timezone || defaultTimezoneForRegion(business?.regionCode);
  const due = await prisma.recurringJob.findMany({
    where: { businessId, active: true, nextRun: { lte: now } },
    orderBy: { nextRun: 'asc' },
  });

  let created = 0;
  for (const r of due) {
    const made = await prisma.$transaction(async (tx) => {
      // Re-read inside the transaction: a concurrent generation may have
      // already advanced nextRun past `now`.
      const fresh = await tx.recurringJob.findFirst({
        where: { id: r.id, businessId, active: true, nextRun: { lte: now } },
      });
      if (!fresh) return false;

      // Skip if a job already exists for this plan on the nextRun day
      // (prevents duplicates if generation runs twice). The window is the
      // business-local day of the occurrence.
      const { gte: dayStart, lt: dayEnd } = occurrenceDayWindow(fresh.nextRun, timeZone);

      const exists = await tx.job.findFirst({
        where: {
          recurringJobId: fresh.id,
          businessId,
          date: { gte: dayStart, lt: dayEnd },
        },
        select: { id: true },
      });

      if (!exists) {
        await tx.job.create({
          data: {
            title: fresh.title,
            date: new Date(fresh.nextRun),
            time: fresh.time,
            address: fresh.address,
            price: fresh.price,
            status: 'SCHEDULED',
            notes: fresh.notes,
            customerId: fresh.customerId,
            businessId,
            recurringJobId: fresh.id,
          },
        });
      }

      // Always advance — even when a job already existed — so a second run
      // moves on to the next occurrence instead of looping on the same day.
      await tx.recurringJob.update({
        where: { id: fresh.id, businessId },
        data: { nextRun: advanceNextRun(fresh.nextRun, fresh.frequency) },
      });

      return !exists;
    });

    if (made) created++;
  }

  return { created };
}
