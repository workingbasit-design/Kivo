/**
 * Integration tests for the shared job/money queries (Part A3).
 * Source: src/lib/job-queries.ts -> getJobCounts / getMoneySummary /
 * getJobsInRange. The Prisma client is stubbed via dependency injection -
 * no real database is touched.
 *
 * Seeds 4 jobs (past, today, future, no date) and asserts all screens
 * would agree: counts, range inclusion, and money totals.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/job-queries.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getJobCounts,
  getMoneySummary,
  getJobsInRange,
  getScheduleWeekJobs,
  getTodayJobs,
  getUpcomingJobs,
  getOverdueJobs,
  getTomorrowJobs,
  getJobs,
} from '../job-queries.ts';
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

/* ------------------------------------------------------------------ */
/* Generic row-backed Prisma stub.                                        */
/*                                                                        */
/* M3 moved the counts and sums into the database (groupBy / aggregate /  */
/* count) instead of fetching rows, so a stub that only answered          */
/* findMany could no longer serve them. Rather than hand-mimic each new   */
/* query, this evaluates `where` generically and derives findMany, count, */
/* aggregate and groupBy from the same seeded rows - so the assertions    */
/* below still describe BEHAVIOUR, not query shape.                       */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

function matchCond(value: unknown, cond: unknown): boolean {
  if (cond === null) return value == null;
  if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
  if (cond !== null && typeof cond === 'object') {
    const c = cond as Record<string, unknown>;
    if ('in' in c) return (c.in as unknown[]).includes(value);
    if ('notIn' in c) return !(c.notIn as unknown[]).includes(value);
    if ('not' in c) return !matchCond(value, c.not);
    if ('none' in c) return Array.isArray(value) && value.length === 0;
    if ('some' in c) return Array.isArray(value) && value.some((r) => matchWhere(r as Row, c.some as Row));
    if ('gte' in c || 'lte' in c || 'gt' in c || 'lt' in c) {
      if (value == null) return false;
      const t = value instanceof Date ? value.getTime() : Number(value);
      const n = (v: unknown) => (v instanceof Date ? v.getTime() : Number(v));
      if ('gte' in c && !(t >= n(c.gte))) return false;
      if ('lte' in c && !(t <= n(c.lte))) return false;
      if ('gt' in c && !(t > n(c.gt))) return false;
      if ('lt' in c && !(t < n(c.lt))) return false;
      return true;
    }
    if (value !== null && typeof value === 'object') return matchWhere(value as Row, c);
    return false;
  }
  return value === cond;
}

function matchWhere(row: Row, where?: Row): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, cond]) => {
    if (k === 'OR') return (cond as Row[]).some((c) => matchWhere(row, c));
    if (k === 'AND') return (cond as Row[]).every((c) => matchWhere(row, c));
    if (k === 'NOT') return !matchWhere(row, cond as Row);
    // businessId is not on the seeded rows; every query is tenant-scoped.
    if (k === 'businessId') return true;
    return matchCond(row[k], cond);
  });
}

function select(rows: Row[], args: Row = {}): Row[] {
  let out = rows.filter((r) => matchWhere(r, args.where as Row | undefined));
  const orderBy = args.orderBy as Row | Row[] | undefined;
  if (orderBy) {
    const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
    out = [...out].sort((a, b) => {
      for (const spec of specs) {
        const [k, dir] = Object.entries(spec)[0];
        const d = dir === 'desc' ? -1 : 1;
        const av = a[k] as never;
        const bv = b[k] as never;
        if (av < bv) return -d;
        if (av > bv) return d;
      }
      return 0;
    });
  }
  if (typeof args.skip === 'number') out = out.slice(args.skip);
  if (typeof args.take === 'number') out = out.slice(0, args.take);
  return out;
}

function sumField(rows: Row[], field: string): bigint | null {
  let total = 0n;
  let seen = false;
  for (const r of rows) {
    const v = r[field];
    if (v == null) continue;
    seen = true;
    total += typeof v === 'bigint' ? v : BigInt(Math.round(Number(v)));
  }
  return seen ? total : null;
}

function model(rows: Row[]) {
  return {
    findMany: async (args: Row = {}) => select(rows, args),
    findFirst: async (args: Row = {}) => select(rows, args)[0] ?? null,
    findUnique: async () => null,
    count: async (args: Row = {}) => select(rows, args).length,
    aggregate: async (args: Row = {}) => {
      const out = select(rows, { where: args.where });
      const res: Row = {};
      if (args._count) res._count = { _all: out.length };
      if (args._sum) {
        const sums: Row = {};
        for (const f of Object.keys(args._sum as Row)) sums[f] = sumField(out, f);
        res._sum = sums;
      }
      return res;
    },
    groupBy: async (args: Row = {}) => {
      const out = select(rows, { where: args.where });
      const by = (Array.isArray(args.by) ? args.by : [args.by]) as string[];
      const buckets = new Map<string, Row[]>();
      for (const r of out) {
        const key = by.map((k) => String(r[k])).join('\u0000');
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(r);
      }
      return [...buckets.values()].map((group) => {
        const row: Row = {};
        for (const k of by) row[k] = group[0][k];
        if (args._count) row._count = { _all: group.length };
        if (args._sum) {
          const sums: Row = {};
          for (const f of Object.keys(args._sum as Row)) sums[f] = sumField(group, f);
          row._sum = sums;
        }
        return row;
      });
    },
  };
}

function makeDb(
  data: { jobs?: Row[]; invoices?: Row[]; quotes?: Row[] } = {}
): JobQueriesDb {
  return {
    job: model(data.jobs ?? JOBS),
    invoice: model(data.invoices ?? []),
    quote: model(data.quotes ?? []),
    payment: model([]),
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
  const db = makeDb({ jobs });
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
  const db = makeDb({ jobs });
  const summary = await getMoneySummary('biz-1', { db });
  assert.equal(summary.readyToInvoice, 150); // only j-done; j-billed has invoice, j-open not completed
  assert.equal(summary.outstanding, 0);
  assert.equal(summary.openQuotes, 0);
});

test('getMoneySummary: outstanding = UNPAID total + PARTIALLY PAID balance', async () => {
  const invoices = [
    { id: 'i1', total: 500, totalCents: 50000n, status: 'UNPAID', voidedAt: null, payments: [] },
    {
      id: 'i2',
      total: 400,
      totalCents: 40000n,
      status: 'PARTIALLY PAID',
      voidedAt: null,
      payments: [{ amount: 150, amountCents: 15000n, status: 'COMPLETED' }],
    },
    {
      id: 'i3',
      total: 300,
      totalCents: 30000n,
      status: 'PARTIALLY PAID',
      voidedAt: null,
      payments: [{ amount: 100, amountCents: 10000n, status: 'PENDING' }], // pending does not reduce balance
    },
  ];
  const db = makeDb({
    jobs: [],
    invoices,
    quotes: [{ id: 'q1', status: 'DRAFT' }, { id: 'q2', status: 'SENT' }],
  });
  const summary = await getMoneySummary('biz-1', { db });
  assert.equal(summary.outstanding, 500 + 250 + 300);
  assert.equal(summary.openQuotes, 2);
});

test('getJobCounts: byStatus groups counts per status', async () => {
  const counts = await getJobCounts('biz-1', { now: NOW, timezone: 'America/Toronto', db: makeDb() });
  assert.equal(counts.byStatus.SCHEDULED, 3);
  assert.equal(counts.byStatus.NEW, 1);
  assert.equal(counts.byStatus.COMPLETED ?? 0, 0);
});

test('getMoneySummary: voided invoices excluded from outstanding', async () => {
  const invoices = [
    { id: 'i1', total: 500, totalCents: 50000n, status: 'UNPAID', voidedAt: null, payments: [] },
    { id: 'i2', total: 700, totalCents: 70000n, status: 'UNPAID', voidedAt: new Date(), payments: [] },
  ];
  const db = makeDb({ invoices, jobs: [] });
  const summary = await getMoneySummary('biz-1', { db });
  assert.equal(summary.outstanding, 500);
  assert.equal(summary.outstandingCount, 1);
});

test('getScheduleWeekJobs: half-open week range', async () => {
  const rows = await getScheduleWeekJobs('biz-1', D('2026-10-12T00:00:00Z'), D('2026-10-19T00:00:00Z'), makeDb());
  const ids = (rows as { id: string }[]).map((r) => r.id);
  assert.ok(ids.includes('j-today'), 'Oct 13 job in [Oct 12, Oct 19)');
  assert.ok(!ids.includes('j-future'), 'Oct 20 job outside the week');
  assert.ok(!ids.includes('j-past'), 'Oct 10 job outside the week');
  assert.ok(!ids.includes('j-nodate'), 'no-date job excluded');
});

test('getTodayJobs: only jobs on the day', async () => {
  const rows = await getTodayJobs('biz-1', D('2026-10-13T00:00:00Z'), D('2026-10-13T23:59:59Z'), makeDb());
  assert.deepEqual((rows as { id: string }[]).map((r) => r.id), ['j-today']);
});

test('getUpcomingJobs: only open jobs after the date', async () => {
  const rows = await getUpcomingJobs('biz-1', D('2026-10-13T23:59:59Z'), makeDb());
  assert.deepEqual((rows as { id: string }[]).map((r) => r.id), ['j-future']);
});

test('getOverdueJobs: past-date open jobs only', async () => {
  const rows = await getOverdueJobs('biz-1', D('2026-10-13T00:00:00Z'), 10, makeDb());
  assert.deepEqual((rows as { id: string }[]).map((r) => r.id), ['j-past']);
});

test('getTomorrowJobs: NEW/SCHEDULED jobs in the range', async () => {
  const empty = await getTomorrowJobs('biz-1', D('2026-10-14T00:00:00Z'), D('2026-10-15T00:00:00Z'), makeDb());
  assert.deepEqual((empty as { id: string }[]).map((r) => r.id), []);
  const rows = await getTomorrowJobs('biz-1', D('2026-10-13T00:00:00Z'), D('2026-10-14T00:00:00Z'), makeDb());
  assert.deepEqual((rows as { id: string }[]).map((r) => r.id), ['j-today']);
});

test('getJobs: status filter + all', async () => {
  const all = await getJobs('biz-1', { db: makeDb() });
  assert.equal(all.length, 4);
  const sched = await getJobs('biz-1', { status: 'SCHEDULED', db: makeDb() });
  assert.equal(sched.length, 3);
  const none = await getJobs('biz-1', { status: 'COMPLETED', db: makeDb() });
  assert.equal(none.length, 0);
});
