/**
 * Part D (dashboard rebuild): in-memory Prisma stub for the dashboard
 * consistency tests.
 *
 * A fixed, timezone-sensitive dataset. "Now"-relative rows (quote
 * updatedAt, communication timestamps) are computed from the mocked
 * clock at query time, so the same dataset works for every scenario.
 *
 * Supports the `where` shapes the dashboard fetchers use: scalar
 * equality, null, `{ in: [...] }`, `{ not: x }`, `{ none: {} }` on
 * relations, `{ gte }`/`{ lte }` on dates, and one level of nested
 * relation filter (`invoice: { voidedAt: null }`).
 */
const D = (s) => new Date(s);
const DAY = 86_400_000;
const MIN = 60_000;

/* ---------------- dataset ---------------- */

const INVOICES = [
  {
    businessId: 'biz',
    id: 'inv-open',
    status: 'UNPAID',
    voidedAt: null,
    date: D('2026-09-01T00:00:00.000Z'), // due 2026-10-01 -> overdue on Oct 17
    totalCents: 10000n,
    payments: [{ status: 'COMPLETED', amountCents: 4000n }],
  },
  {
    businessId: 'biz',
    id: 'inv-partial',
    status: 'PARTIALLY PAID',
    voidedAt: null,
    date: D('2026-10-10T00:00:00.000Z'), // due 2026-11-09 -> not overdue
    totalCents: 20000n,
    payments: [{ status: 'COMPLETED', amountCents: 5000n }],
  },
  {
    businessId: 'biz',
    id: 'inv-void',
    status: 'UNPAID',
    voidedAt: D('2026-10-12T00:00:00.000Z'),
    date: D('2026-09-01T00:00:00.000Z'),
    totalCents: 999900n,
    payments: [],
  },
  {
    businessId: 'biz',
    id: 'inv-draft',
    status: 'DRAFT',
    voidedAt: null,
    date: D('2026-10-10T00:00:00.000Z'),
    totalCents: 999900n,
    payments: [],
  },
];

const JOBS = [
  {
    businessId: 'biz',
    id: 'job-ready-1', status: 'COMPLETED', archivedAt: null,
    priceCents: 15000n, invoices: [],
    date: D('2026-10-15T18:00:00.000Z'), time: null, startAt: null,
    title: 'Ready one', customer: { name: 'Alice', address: '1 Main St, Etobicoke' },
    service: null, technician: null, assignedTo: null,
  },
  {
    businessId: 'biz',
    id: 'job-ready-2', status: 'COMPLETED', archivedAt: null,
    priceCents: 5000n, invoices: [],
    date: D('2026-10-14T18:00:00.000Z'), time: null, startAt: null,
    title: 'Ready two', customer: { name: 'Bob', address: '2 Main St, Etobicoke' },
    service: null, technician: null, assignedTo: null,
  },
  {
    businessId: 'biz',
    id: 'job-billed', status: 'COMPLETED', archivedAt: null,
    priceCents: 8000n, invoices: [{ id: 'inv-x' }],
    date: D('2026-10-13T18:00:00.000Z'), time: null, startAt: null,
    title: 'Billed', customer: { name: 'Cara', address: '3 Main St, Etobicoke' },
    service: null, technician: null, assignedTo: null,
  },
  {
    businessId: 'biz',
    id: 'job-new-unsched', status: 'NEW', archivedAt: null,
    priceCents: 12000n, invoices: [],
    date: D('2026-10-22T18:00:00.000Z'), time: null, startAt: null,
    title: 'Unscheduled', customer: { name: 'Dan', address: '4 Main St, Etobicoke' },
    service: null, technician: null, assignedTo: null,
  },
  {
    businessId: 'biz',
    id: 'job-sched', status: 'SCHEDULED', archivedAt: null,
    priceCents: 9000n, invoices: [],
    date: D('2026-10-20T18:00:00.000Z'), time: '10:00', startAt: null,
    title: 'Scheduled', customer: { name: 'Erin', address: '5 Main St, Etobicoke' },
    service: null, technician: null, assignedTo: null,
  },
  {
    businessId: 'biz',
    // 2026-10-17T18:00Z is Oct 17 in Toronto (14:00 EDT), Vancouver
    // (11:00 PDT) and St_Johns (15:30 NDT): "today" in all scenarios.
    id: 'job-today', status: 'SCHEDULED', archivedAt: null,
    priceCents: 7000n, invoices: [],
    date: D('2026-10-17T18:00:00.000Z'), time: '14:00', startAt: null,
    title: 'Today visit', customer: { name: 'Fay', address: '6 Main St, Etobicoke' },
    service: null, technician: null, assignedTo: null,
  },
  {
    businessId: 'biz',
    id: 'job-yesterday', status: 'COMPLETED', archivedAt: null,
    priceCents: 4000n, invoices: [{ id: 'inv-y' }],
    date: D('2026-10-16T18:00:00.000Z'), time: null, startAt: null,
    title: 'Yesterday', customer: { name: 'Gus', address: '7 Main St, Etobicoke' },
    service: null, technician: null, assignedTo: null,
  },
  {
    businessId: 'biz',
    id: 'job-cancelled', status: 'CANCELLED', archivedAt: null,
    priceCents: 3000n, invoices: [],
    date: D('2026-10-17T18:00:00.000Z'), time: null, startAt: null,
    title: 'Cancelled', customer: { name: 'Hal', address: '8 Main St, Etobicoke' },
    service: null, technician: null, assignedTo: null,
  },
];

const QUOTES = () => [
  {
    businessId: 'biz',
    id: 'quote-fresh', status: 'SENT', totalCents: 25000n,
    updatedAt: new Date(Date.now() - 2 * DAY),
  },
  {
    businessId: 'biz',
    id: 'quote-expiring', status: 'SENT', totalCents: 30000n,
    updatedAt: new Date(Date.now() - 25 * DAY), // inside the 23-30d "expiring soon" window
  },
  { id: 'quote-draft', status: 'DRAFT', totalCents: 999900n, updatedAt: new Date(Date.now() - DAY) },
];

const LEADS = [
  { businessId: 'biz', id: 'lead-1', status: 'NEW' },
  { businessId: 'biz', id: 'lead-2', status: 'NEW' },
  { businessId: 'biz', id: 'lead-3', status: 'CONTACTED' },
];

const COMMUNICATIONS = () => [
  {
    businessId: 'biz',
    id: 'comm-1', status: 'REPLIED',
    waitingSince: new Date(Date.now() - 30 * MIN),
    updatedAt: new Date(Date.now() - 18 * MIN), // first reply took 12 min
    createdAt: new Date(Date.now() - 30 * MIN),
  },
  {
    businessId: 'biz',
    id: 'comm-2', status: 'WAITING',
    waitingSince: new Date(Date.now() - 40 * MIN),
    updatedAt: new Date(Date.now() - 40 * MIN),
    createdAt: new Date(Date.now() - 40 * MIN),
  },
];

const PAYMENTS = [
  {
    businessId: 'biz',
    // 02:45Z = 22:45 EDT Oct 17 (Toronto: today), 19:45 PDT Oct 17
    // (Vancouver: today), 00:15 NDT Oct 18 (St_Johns: tomorrow).
    id: 'pay-boundary', status: 'COMPLETED', amountCents: 6000n,
    createdAt: D('2026-10-18T02:45:00.000Z'),
    invoice: { voidedAt: null },
  },
  {
    businessId: 'biz',
    id: 'pay-older', status: 'COMPLETED', amountCents: 12000n,
    createdAt: D('2026-10-15T15:00:00.000Z'),
    invoice: { voidedAt: null },
  },
  {
    businessId: 'biz',
    id: 'pay-pending', status: 'PENDING', amountCents: 999900n,
    createdAt: D('2026-10-15T15:00:00.000Z'),
    invoice: { voidedAt: null },
  },
];

/* ---------------- where-clause evaluator ---------------- */

function cmpVal(rowVal, cond) {
  if (cond === null || cond === undefined) return rowVal == null;
  if (typeof cond !== 'object' || cond instanceof Date) {
    return rowVal instanceof Date && cond instanceof Date
      ? rowVal.getTime() === cond.getTime()
      : rowVal === cond;
  }
  if ('in' in cond) return cond.in.includes(rowVal);
  if ('not' in cond) return rowVal !== cond.not;
  if ('gte' in cond || 'lte' in cond || 'gt' in cond || 'lt' in cond) {
    const t = rowVal instanceof Date ? rowVal.getTime() : rowVal;
    if ('gte' in cond && !(t >= cond.gte.getTime())) return false;
    if ('lte' in cond && !(t <= cond.lte.getTime())) return false;
    if ('gt' in cond && !(t > cond.gt.getTime())) return false;
    if ('lt' in cond && !(t < cond.lt.getTime())) return false;
    return true;
  }
  if ('none' in cond) return Array.isArray(rowVal) && rowVal.length === 0;
  if ('some' in cond) return Array.isArray(rowVal) && rowVal.some((r) => matches(r, cond.some));
  // nested relation filter, e.g. invoice: { voidedAt: null }
  if (rowVal !== null && typeof rowVal === 'object') return matches(rowVal, cond);
  return false;
}

function matches(row, where) {
  if (!where) return true;
  return Object.entries(where).every(([k, cond]) => cmpVal(row[k], cond));
}

function applyArgs(rows, args = {}) {
  let out = rows.filter((r) => matches(r, args.where));
  if (args.orderBy) {
    const specs = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
    out = [...out].sort((a, b) => {
      for (const s of specs) {
        const [k, dir] = Object.entries(s)[0];
        const d = dir === 'desc' ? -1 : 1;
        if (a[k] < b[k]) return -d;
        if (a[k] > b[k]) return d;
      }
      return 0;
    });
  }
  if (args.take != null) out = out.slice(0, args.take);
  return out;
}

const model = (rows) => ({
  findMany: async (args) => applyArgs(typeof rows === 'function' ? rows() : rows, args),
  findFirst: async (args) => applyArgs(typeof rows === 'function' ? rows() : rows, args)[0] ?? null,
  findUnique: async () => null,
  count: async (args) => applyArgs(typeof rows === 'function' ? rows() : rows, args).length,
});

export const prisma = {
  invoice: model(INVOICES),
  job: model(JOBS),
  quote: model(QUOTES),
  lead: model(LEADS),
  communication: model(COMMUNICATIONS),
  payment: model(PAYMENTS),
  business: { findUnique: async () => null },
};
