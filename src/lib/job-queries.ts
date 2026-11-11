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
import { isJobLate, LATE_ELIGIBLE_STATUSES } from './job-status.ts';
import { dayRangeInTimezone, toISODateInTimezone } from './utils.ts';
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

/**
 * M3: counts are computed BY THE DATABASE, not by loading rows.
 *
 * This used to findMany() every job row for the business - with each job's
 * invoice ids attached - purely to produce six numbers, on every dashboard,
 * jobs and schedule render. At a few thousand jobs that is megabytes over
 * the wire per page view, and it grows forever.
 *
 * Note this is deliberately NOT "add a limit": capping the fetch would make
 * the totals silently WRONG, which is worse than slow. Aggregating in SQL
 * keeps every number exact while transferring a handful of rows.
 *
 * The late filter mirrors isJobLate() exactly:
 *   - only NEW/SCHEDULED are late-eligible (shared constant), and
 *   - a job with a startAt is late once that instant has passed, otherwise
 *     a dated job is late when its date falls before today in the business
 *     timezone. Job.date stores that timezone's midnight, so comparing
 *     against today's midnight in the same zone is the same comparison the
 *     day-key string compare was doing.
 */
export async function getJobCounts(
  businessId: string,
  opts: { timezone?: string; now?: Date; db?: Db } = {},
): Promise<JobCounts> {
  const { timezone = 'America/Toronto', now = new Date(), db = defaultPrisma } = opts;
  const { gte: todayStart } = dayRangeInTimezone(toISODateInTimezone(now, timezone), timezone);

  const [grouped, uninvoiced, late] = await Promise.all([
    db.job.groupBy({
      by: ['status'],
      where: { businessId },
      _count: { _all: true },
    }),
    db.job.count({
      where: { businessId, status: 'COMPLETED', invoices: { none: {} } },
    }),
    db.job.count({
      where: {
        businessId,
        status: { in: [...LATE_ELIGIBLE_STATUSES] },
        OR: [
          { startAt: { lt: now } },
          { AND: [{ startAt: null }, { date: { lt: todayStart } }] },
        ],
      },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const g of grouped) byStatus[g.status] = g._count._all;
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const scheduled = (byStatus.NEW ?? 0) + (byStatus.SCHEDULED ?? 0);
  const completed = byStatus.COMPLETED ?? 0;

  return { total, scheduled, late, completed, uninvoiced, byStatus };
}

export async function getMoneySummary(
  businessId: string,
  opts: { db?: Db } = {},
): Promise<MoneySummary> {
  const { db = defaultPrisma } = opts;

  // M3: this used to load EVERY unpaid invoice with all of its payments, and
  // every completed-uninvoiced job, just to produce three totals.
  //
  // UNPAID invoices need no payment data at all (the whole total is
  // outstanding), so they are summed by the database.
  //
  // PARTIALLY PAID invoices do need their payments, because the balance is
  // clamped PER INVOICE: Math.max(0, total - paid). An overpaid invoice must
  // contribute 0, never a negative that silently cancels out someone else's
  // balance - so a single global SUM(total) - SUM(paid) would be a different,
  // wrong number. Those are therefore still walked, but in bounded pages so
  // memory stays flat however many there are, and the arithmetic is
  // unchanged.
  const PAGE = 500;

  const [unpaidAgg, partialCount, readyAgg, openQuotes] = await Promise.all([
    db.invoice.aggregate({
      where: { businessId, status: 'UNPAID', voidedAt: null },
      _sum: { totalCents: true },
      _count: { _all: true },
    }),
    db.invoice.count({
      where: { businessId, status: 'PARTIALLY PAID', voidedAt: null },
    }),
    db.job.aggregate({
      where: { businessId, status: 'COMPLETED', invoices: { none: {} } },
      _sum: { priceCents: true },
    }),
    db.quote.count({
      where: { businessId, status: { in: ['DRAFT', 'SENT'] } },
    }),
  ]);

  let outstanding = centsToDollars(unpaidAgg._sum.totalCents ?? 0);

  for (let skip = 0; skip < partialCount; skip += PAGE) {
    const page = await db.invoice.findMany({
      where: { businessId, status: 'PARTIALLY PAID', voidedAt: null },
      select: {
        totalCents: true,
        payments: { select: { amountCents: true, status: true } },
      },
      orderBy: { id: 'asc' },
      skip,
      take: PAGE,
    });
    if (page.length === 0) break;
    for (const inv of page) {
      const total = centsToDollars(inv.totalCents);
      let paid = 0;
      for (const p of inv.payments) {
        if (p.status !== 'COMPLETED') continue;
        paid += centsToDollars(p.amountCents);
      }
      outstanding += Math.max(0, total - paid);
    }
  }

  const readyToInvoice = centsToDollars(readyAgg._sum.priceCents ?? 0);

  return {
    outstanding,
    outstandingCount: unpaidAgg._count._all + partialCount,
    readyToInvoice,
    openQuotes,
  };
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

/**
 * Jobs list screen (all-modules redesign, Part 3 group 1): every job for
 * the business with exactly the fields the ListScreen rows need — trade
 * icon (via service), assignee, invoice linkage (for "not invoiced"), and
 * the start/end instants the Late / Running-over rules need. One source of
 * truth with getJobCounts and the Dashboard / Schedule screens.
 */
export async function getJobsForList(
  businessId: string,
  db: Db = defaultPrisma,
  opts: { take?: number } = {},
) {
  return db.job.findMany({
    where: { businessId },
    select: {
      id: true,
      title: true,
      date: true,
      time: true,
      timeTbd: true,
      startAt: true,
      endAt: true,
      status: true,
      priceCents: true,
      noCharge: true,
      address: true,
      technician: true,
      customer: { select: { id: true, name: true } },
      service: {
        select: { name: true, nameFr: true, category: true, iconKey: true },
      },
      assignedTo: { select: { id: true, name: true } },
      invoices: { select: { id: true, status: true } },
    },
    // M3: bounded. The window is the most recent rows by date (descending),
    // because an ascending take would hand back the business's OLDEST jobs
    // and never reach today. The caller sorts back into ascending order for
    // display, so the rendered grouping is unchanged.
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    ...(opts.take != null ? { take: opts.take } : {}),
  });
}

export type JobsForListRow = Awaited<ReturnType<typeof getJobsForList>>[number];
