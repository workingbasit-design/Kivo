/**
 * Shared job/money queries (Part A3) — one source of truth for counts.
 *
 * Dashboard, Jobs, Schedule, and Money must all import from here so the
 * same jobs are counted the same way on every screen. The `db` parameter
 * is dependency injection for tests: production call sites omit it and the
 * real Prisma client is used.
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
}

export interface MoneySummary {
  /** Sum of unpaid balances: full total for UNPAID, total minus COMPLETED
   *  payments for PARTIALLY PAID. Dollars. */
  outstanding: number;
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
  for (const j of jobs) {
    if (j.status === 'NEW' || j.status === 'SCHEDULED') scheduled++;
    if (j.status === 'COMPLETED') {
      completed++;
      if (j.invoices.length === 0) uninvoiced++;
    }
    if (isJobLate(j, now, timezone)) late++;
  }
  return { total: jobs.length, scheduled, late, completed, uninvoiced };
}

export async function getMoneySummary(
  businessId: string,
  opts: { db?: Db } = {},
): Promise<MoneySummary> {
  const { db = defaultPrisma } = opts;

  const invoices = await db.invoice.findMany({
    where: { businessId, status: { in: ['UNPAID', 'PARTIALLY PAID'] } },
    select: {
      total: true,
      totalCents: true,
      status: true,
      payments: { select: { amount: true, amountCents: true, status: true } },
    },
  });
  let outstanding = 0;
  for (const inv of invoices) {
    const total = inv.totalCents != null ? centsToDollars(inv.totalCents) : inv.total;
    if (inv.status === 'UNPAID') {
      outstanding += total;
    } else {
      // PARTIALLY PAID: subtract COMPLETED payments only.
      let paid = 0;
      for (const p of inv.payments) {
        if (p.status !== 'COMPLETED') continue;
        paid += p.amountCents != null ? centsToDollars(p.amountCents) : p.amount;
      }
      outstanding += Math.max(0, total - paid);
    }
  }

  const readyJobs = await db.job.findMany({
    where: { businessId, status: 'COMPLETED', invoices: { none: {} } },
    select: { price: true, priceCents: true },
  });
  let readyToInvoice = 0;
  for (const j of readyJobs) {
    readyToInvoice += j.priceCents != null ? centsToDollars(j.priceCents) : j.price;
  }

  const openQuotes = await db.quote.count({
    where: { businessId, status: { in: ['DRAFT', 'SENT'] } },
  });

  return { outstanding, readyToInvoice, openQuotes };
}
