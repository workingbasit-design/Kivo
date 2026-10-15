/**
 * Shared job/money queries (Part A3) - one source of truth for counts.
 *
 * Dashboard, Jobs, Schedule, Money, and Owner must all import from here so
 * the same jobs are counted the same way on every screen. The `db`
 * parameter is dependency injection for tests: production call sites omit
 * it and the real Prisma client is used.
 *
 * Functions:
 * - getJobsInRange: jobs whose date falls in [start, end] (closed).
 * - getJobCounts: total / scheduled / late / completed / uninvoiced /
 *   per-status counts, from one fetch.
 * - getMoneySummary: outstanding / readyToInvoice / openQuotes (+ counts).
 * - getScheduleWeekJobs: Schedule week view ([gte, lt), with assignee).
 * - getTodayJobs: today's jobs ordered by time (Dashboard).
 * - getUpcomingJobs: next open jobs after a date (Dashboard).
 * - getOverdueJobs: past-date open jobs (Schedule overdue section).
 * - getTomorrowJobs: tomorrow's NEW/SCHEDULED jobs (Owner page).
 * - getJobs: Jobs page list, optional status filter.
 */
import { prisma as defaultPrisma } from '@/lib/prisma';
import { isJobLate } from './job-status.ts';
import { centsToDollars } from './money.ts';

type Db = typeof defaultPrisma;
/** Database client shape accepted by the query functions (real Prisma
 *  client in production; a stub in tests). */
export type JobQueriesDb = Db;

export interface JobCounts {
  total: number;
  /** NEW + SCHEDULED jobs. */
  scheduled: number;
  /** Derived via isJobLate (business timezone); never stored. */
  late: number;
  completed: number;
  /** COMPLETED jobs with no linked invoice. */
  uninvoiced: number;
  /** Per-status counts, from the same fetch (only statuses present). */
  byStatus: Record<string, number>;
}

export interface MoneySummary {
  /** Sum of unpaid balances: full total for UNPAID, total minus COMPLETED
   *  payments for PARTIALLY PAID. Dollars. Voided invoices excluded. */
  outstanding: number;
  /** Count of UNPAID / PARTIALLY PAID non-voided invoices. */
  outstandingCount: number;
  /** Sum of COMPLETED jobs with no linked invoice. Dollars. */
  readyToInvoice: number;
  /** Count of DRAFT + SENT quotes. */
  openQuotes: number;
}

/** Jobs whose date falls in [start, end], including Late ones. */
export async function getJobsInRange(
  businessId: string,
  start: Date,
  end: Date,
  db: Db = defaultPrisma,
) {
  return db.job.findMany({
    where: { businessId, date: { gte: start, lte: end } },
    orderBy: { date: 'asc' },
    include: { customer: { select: { id: true, name: true } } },
  });
}

export async function getJobCounts(
  businessId: string,
  opts: { timezone?: string; now?: Date; db?: Db } = {},
): Promise<JobCounts> {
  const { timezone = 'America/Toronto', now = new Date(), db = defaultPrisma } = opts;
  const jobs = await db.job.findMany({
    where: { businessId },
    select: {
      id: true,
      status: true,
      date: true,
      invoices: { select: { id: true } },
    },
  });
  let scheduled = 0;
  let late = 0;
  let completed = 0;
  let uninvoiced = 0;
  const byStatus: Record<string, number> = {};
  for (const j of jobs) {
    byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
    if (j.status === 'NEW' || j.status === 'SCHEDULED') scheduled++;
    if (j.status === 'COMPLETED') {
      completed++;
      if (j.invoices.length === 0) uninvoiced++;
    }
    if (isJobLate(j, now, timezone)) late++;
  }
  return { total: jobs.length, scheduled, late, completed, uninvoiced, byStatus };
}

export async function getMoneySummary(
  businessId: string,
  opts: { db?: Db } = {},
): Promise<MoneySummary> {
  const { db = defaultPrisma } = opts;

  // Voided invoices are excluded from reports (Part A7).
  const invoices = await db.invoice.findMany({
    where: { businessId, status: { in: ['UNPAID', 'PARTIALLY PAID'] }, voidedAt: null },
    select: {
      totalCents: true,
      status: true,
      payments: { select: { amountCents: true, status: true } },
    },
  });
  let outstanding = 0;
  for (const inv of invoices) {
    const total = centsToDollars(inv.totalCents);
    if (inv.status === 'UNPAID') {
      outstanding += total;
    } else {
      // PARTIALLY PAID: subtract COMPLETED payments only.
      let paid = 0;
      for (const p of inv.payments) {
        if (p.status !== 'COMPLETED') continue;
        paid += centsToDollars(p.amountCents);
      }
      outstanding += Math.max(0, total - paid);
    }
  }

  const readyJobs = await db.job.findMany({
    where: { businessId, status: 'COMPLETED', invoices: { none: {} } },
    select: { priceCents: true },
  });
  let readyToInvoice = 0;
  for (const j of readyJobs) {
    readyToInvoice += centsToDollars(j.priceCents);
  }

  const openQuotes = await db.quote.count({
    where: { businessId, status: { in: ['DRAFT', 'SENT'] } },
  });

  return { outstanding, outstandingCount: invoices.length, readyToInvoice, openQuotes };
}

/** Schedule week view: jobs in [weekStart, weekEnd) with customer + assignee,
 *  ordered by date then creation. The half-open range is what makes the week
 *  grid exact (a job on Monday 00:00 belongs to this week, not last). */
export async function getScheduleWeekJobs(
  businessId: string,
  weekStart: Date,
  weekEnd: Date,
  db: Db = defaultPrisma,
) {
  return db.job.findMany({
    where: { businessId, date: { gte: weekStart, lt: weekEnd } },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
}

/** Today's jobs ordered by start time — Dashboard "Today's schedule".
 *  Time lives in the separate `time` string field, so ordering by `date`
 *  alone would not order by time within the day. */
export async function getTodayJobs(
  businessId: string,
  dayStart: Date,
  dayEnd: Date,
  db: Db = defaultPrisma,
) {
  return db.job.findMany({
    where: { businessId, date: { gte: dayStart, lte: dayEnd } },
    include: { customer: { select: { name: true } } },
    orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
  });
}

const OPEN_JOB_STATUSES = ['NEW', 'SCHEDULED', 'IN PROGRESS'];

/** Next open jobs after `after` — Dashboard "Upcoming". */
export async function getUpcomingJobs(
  businessId: string,
  after: Date,
  db: Db = defaultPrisma,
) {
  return db.job.findMany({
    where: {
      businessId,
      date: { gt: after },
      status: { in: OPEN_JOB_STATUSES },
    },
    include: { customer: { select: { name: true } } },
    orderBy: { date: 'asc' },
    take: 5,
  });
}

/** Past-date open jobs — Schedule overdue section. These are invisible in
 *  the week grid (they are not in the current week) but the owner must see
 *  them. Includes IN PROGRESS so in-progress work that slipped is not hidden
 *  (consistent with isJobLate since BUG-P4-001, 2026-10-15). */
export async function getOverdueJobs(
  businessId: string,
  before: Date,
  take: number = 10,
  db: Db = defaultPrisma,
) {
  return db.job.findMany({
    where: {
      businessId,
      date: { lt: before },
      status: { in: OPEN_JOB_STATUSES },
    },
    select: {
      id: true,
      title: true,
      date: true,
      status: true,
      customer: { select: { name: true } },
    },
    orderBy: { date: 'asc' },
    take,
  });
}

/** Tomorrow's NEW/SCHEDULED jobs — Owner page. */
export async function getTomorrowJobs(
  businessId: string,
  start: Date,
  end: Date,
  db: Db = defaultPrisma,
) {
  return db.job.findMany({
    where: {
      businessId,
      date: { gte: start, lt: end },
      status: { in: ['NEW', 'SCHEDULED'] },
    },
    select: { id: true, title: true, time: true, customer: { select: { name: true } } },
    orderBy: { time: 'asc' },
    take: 10,
  });
}

/** Jobs page list: all jobs, optionally filtered by one status, newest
 *  first. Customer phone is included to match the previous inline query. */
export async function getJobs(
  businessId: string,
  opts: { status?: string; db?: Db } = {},
) {
  const { status, db = defaultPrisma } = opts;
  return db.job.findMany({
    where: {
      businessId,
      ...(status && status !== 'ALL' ? { status } : {}),
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
}
