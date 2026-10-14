/**
 * Integration tests for the shared job/money queries (Part A3).
 * Source: src/lib/job-queries.ts -> getJobCounts / getMoneySummary /
 * getJobsInRange. The Prisma client is stubbed via dependency injection —
 * no real database is touched.
 *
 * Seeds 4 jobs (past, today, future, no date) and asserts all screens
 * would agree: counts, range inclusion, and money totals.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/job-queries.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getJobCounts, getMoneySummary, getJobsInRange } from '../job-queries.ts';
import type { JobQueriesDb } from '../job-queries.ts';

const D = (iso: string) => new Date(iso);
const NOW = D('2026-10-13T12:00:00Z'); // 08:00 Toronto Oct 13

// 4 jobs: past (Oct 10), today (Oct 13), future (Oct 20), no date.
const JOBS = [
  { id: 'j-past', status: 'SCHEDULED', date: D('2026-10-10T16:00:00Z'), price: 100, priceCents: 10000n, invoices: [] },
  { id: 'j-today', status: 'SCHEDULED', date: D('2026-10-13T16:00:00Z'), price: 200, priceCents: 20000n, invoices: [] },
  { id: 'j-future', status: 'SCHEDULED', date: D('2026-10-20T16:00:00Z'), price: 300, priceCents: 30000n, invoices: [] },
  { id: 'j-nodate', status: 'NEW', date: null, price: 50, priceCents: 5000n, invoices: [] },
];

function makeDb(over: Record<string, unknown> = {}): JobQueriesDb {
  return {
    job: {
      findMany: async (args: { where?: Record<string, unknown> }) => {
        // getJobsInRange: date-range filter.
        const where = args?.where as { date?: { gte?: Date; lte?: Date } } | undefined;
        if (where?.date) {
          const { gte, lte } = where.date;
          return JOBS.filter((j) => j.date && j.date >= (gte as Date) && j.date <= (lte as Date));
        }
        // getJobCounts / getMoneySummary: return all jobs for the business.
        return JOBS;
      },
    },
    invoice: {
      findMany: async () => [],
    },
    quote: {
      count: async () => 0,
    },
    ...over,
  } as unknown as JobQueriesDb;
}

test('getJobCounts: 4 seeded jobs agree across screens', async () => {
  const counts = await getJobCounts('biz-1', { now: NOW, timezone: 'America/Toronto', db: makeDb() });
  assert.equal(counts.total, 4);
  assert.equal(counts.scheduled, 4); // 3 SCHEDULED + 1 NEW
  assert.equal(counts.late, 1); // only the Oct 10 job is past-due
  assert.equal(counts.completed, 0);
  assert.equal(counts.uninvoiced, 0);
});

test('getJobCounts: no-date job is counted but never late', async () => {
  const counts = await getJobCounts('biz-1', { now: NOW, timezone: 'America/Toronto', db: makeDb() });
  // j-nodate has no date: included in total/scheduled, excluded from late.
  assert.equal(counts.total, 4);
  assert.equal(counts.late, 1);
});

test('getJobCounts: completed job without invoice counts as uninvoiced', async () => {
  const jobs = [
    { id: 'j-done', status: 'COMPLETED', date: D('2026-10-12T16:00:00Z'), price: 150, priceCents: 15000n, invoices: [] },
    { id: 'j-billed', status: 'COMPLETED', date: D('2026-10-11T16:00:00Z'), price: 250, priceCents: 25000n, invoices: [{ id: 'inv-1' }] },
  ];
  const db = makeDb({
    job: { findMany: async () => jobs },
  });
  const counts = await getJobCounts('biz-1', { now: NOW, timezone: 'America/Toronto', db });
  assert.equal(counts.completed, 2);
  assert.equal(counts.uninvoiced, 1);
  assert.equal(counts.late, 0); // COMPLETED jobs are never late
});

test('getJobsInRange: includes past (Late), today, future; excludes no-date', async () => {
  const rows = await getJobsInRange('biz-1', D('2026-10-01T00:00:00Z'), D('2026-10-31T23:59:59Z'), makeDb());
  const ids = (rows as { id: string }[]).map((r) => r.id);
  assert.ok(ids.includes('j-past'), 'past job in range');
  assert.ok(ids.includes('j-today'), 'today job in range');
  assert.ok(ids.includes('j-future'), 'future job in range');
  assert.ok(!ids.includes('j-nodate'), 'no-date job excluded from date range');
});

test('getMoneySummary: ready-to-invoice sums uninvoiced COMPLETED jobs', async () => {
  const jobs = [
    { id: 'j-done', status: 'COMPLETED', date: D('2026-10-12T16:00:00Z'), price: 150, priceCents: 15000n, invoices: [] },
    { id: 'j-billed', status: 'COMPLETED', date: D('2026-10-11T16:00:00Z'), price: 250, priceCents: 25000n, invoices: [{ id: 'inv-1' }] },
    { id: 'j-open', status: 'SCHEDULED', date: D('2026-10-13T16:00:00Z'), price: 999, priceCents: 99900n, invoices: [] },
  ];
  const db = makeDb({
    job: {
      findMany: async (args: { where?: { status?: string; invoices?: { none?: object } } }) => {
        // Mimic the real where: COMPLETED + invoices none.
        if (args?.where?.status === 'COMPLETED' && args?.where?.invoices?.none) {
          return jobs.filter((j) => j.status === 'COMPLETED' && j.invoices.length === 0);
        }
        return jobs;
      },
    },
  });
  const summary = await getMoneySummary('biz-1', { db });
  assert.equal(summary.readyToInvoice, 150); // only j-done; j-billed has invoice, j-open not completed
  assert.equal(summary.outstanding, 0);
  assert.equal(summary.openQuotes, 0);
});

test('getMoneySummary: outstanding = UNPAID total + PARTIALLY PAID balance', async () => {
  const invoices = [
    { total: 500, totalCents: 50000n, status: 'UNPAID', payments: [] },
    {
      total: 400,
      totalCents: 40000n,
      status: 'PARTIALLY PAID',
      payments: [{ amount: 150, amountCents: 15000n, status: 'COMPLETED' }],
    },
    {
      total: 300,
      totalCents: 30000n,
      status: 'PARTIALLY PAID',
      payments: [{ amount: 100, amountCents: 10000n, status: 'PENDING' }], // pending does not reduce balance
    },
  ];
  const db = makeDb({
    job: {
      findMany: async (args: { where?: { status?: string; invoices?: { none?: object } } }) => {
        if (args?.where?.status === 'COMPLETED' && args?.where?.invoices?.none) {
          return [];
        }
        return [];
      },
    },
    invoice: { findMany: async () => invoices },
    quote: { count: async () => 2 },
  });
  const summary = await getMoneySummary('biz-1', { db });
  assert.equal(summary.outstanding, 500 + 250 + 300);
  assert.equal(summary.openQuotes, 2);
});
