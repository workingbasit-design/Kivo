/**
 * Test-only prisma stub for the notification sync test. Implements just the
 * delegates syncNotifications() touches, backed by in-memory fixtures, and
 * records every call so tests can assert tenant scoping (businessId on every
 * query) and dedupe behavior.
 */
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

export const calls = [];
export const created = [];

function job(id, businessId, dateOffsetDays, status, time = '10:00', notes = null) {
  return {
    id,
    businessId,
    title: `Job ${id}`,
    date: new Date(now + dateOffsetDays * DAY),
    time,
    status,
    notes,
    customer: { name: `Customer ${id}` },
    createdAt: new Date(now - 1 * DAY),
  };
}

const FIXTURES = {
  business: {
    'biz-test': { timezone: 'America/Toronto', regionCode: 'CA', notificationSettings: null },
  },
  jobs: [
    job('jt1', 'biz-test', 1, 'SCHEDULED'), // tomorrow -> job_tomorrow
    job('jtX', 'biz-other', 1, 'SCHEDULED'), // other tenant -> must be ignored
    job('jn1', 'biz-test', 0, 'NEW', '10:00', 'Booked online via booking page.'), // booking_new
    job('jc1', 'biz-test', 5, 'CANCELLED'), // inactive -> ignored
  ],
  invoices: [
    { id: 'i1', number: 'INV-1', date: new Date(now - 45 * DAY), total: 500, status: 'UNPAID', customer: { name: 'Marc' } },
    { id: 'iX', number: 'INV-X', date: new Date(now - 45 * DAY), total: 999, status: 'UNPAID', customer: { name: 'Other' } },
  ],
  quotes: [
    { id: 'q1', number: 'Q-1', total: 900, status: 'SENT', createdAt: new Date(now - 40 * DAY), customer: { name: 'Ava' } },
  ],
  payments: [
    { id: 'p1', amount: 250, createdAt: new Date(now - 1 * DAY), invoiceId: 'i1', invoice: { number: 'INV-1', customer: { name: 'Marc' } } },
  ],
};

function scoped(rows, where, businessIdKey = 'businessId') {
  return rows.filter((r) => {
    if (where?.[businessIdKey] !== undefined && r[businessIdKey] !== where[businessIdKey]) return false;
    if (where?.status?.in && !where.status.in.includes(r.status)) return false;
    if (where?.id !== undefined && r.id !== where.id) return false;
    return true;
  });
}

export const prisma = {
  business: {
    findUnique: async ({ where }) => {
      calls.push(['business.findUnique', where]);
      return FIXTURES.business[where.id] ?? null;
    },
    update: async ({ where, data }) => {
      calls.push(['business.update', where, data]);
      return { id: where.id };
    },
  },
  job: {
    findMany: async ({ where }) => {
      calls.push(['job.findMany', where]);
      // Enforce the tenant boundary the same way the real query does.
      return scoped(FIXTURES.jobs, where).slice(0, where?.take ?? 100);
    },
  },
  invoice: {
    findMany: async ({ where }) => {
      calls.push(['invoice.findMany', where]);
      const biz = where?.businessId;
      return FIXTURES.invoices
        .filter((i) => (biz === 'biz-test' ? i.id !== 'iX' : i.id === 'iX'))
        .filter((i) => !where?.status?.in || where.status.in.includes(i.status))
        .slice(0, where?.take ?? 100);
    },
  },
  quote: {
    findMany: async ({ where }) => {
      calls.push(['quote.findMany', where]);
      return where?.businessId === 'biz-test' ? FIXTURES.quotes : [];
    },
  },
  payment: {
    findMany: async ({ where }) => {
      calls.push(['payment.findMany', where]);
      return where?.invoice?.businessId === 'biz-test' ? FIXTURES.payments : [];
    },
  },
  notification: {
    createMany: async ({ data, skipDuplicates }) => {
      calls.push(['notification.createMany', data.length, skipDuplicates]);
      created.push(...data);
      return { count: data.length };
    },
    deleteMany: async ({ where }) => {
      calls.push(['notification.deleteMany', where]);
      return { count: 0 };
    },
    findMany: async () => [],
    count: async () => 0,
    updateMany: async () => ({ count: 0 }),
  },
};

export function resetNotificationStub() {
  calls.length = 0;
  created.length = 0;
}
