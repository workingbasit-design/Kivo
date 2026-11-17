/**
 * In-memory stand-in for the modules convertQuoteToJob (src/app/actions/quotes.ts)
 * touches. The stubbed job.findFirst runs the REAL duplicate-conversion guard
 * inside the action against scripted rows, so a regression (no marker check)
 * lets job.create run twice — exactly the 2026-10-19 morning QA bug
 * (Q-0001 converted into two jobs).
 */

export const createCalls = [];
export const jobFindFirstCalls = [];
/** Scripted row returned by job.findFirst: null = not yet converted. */
export let jobFindFirstResult = null;

export function setJobFindFirstResult(row) {
  jobFindFirstResult = row;
}

export function resetQuoteConvertStub() {
  rateLimitRows.clear();
  createCalls.length = 0;
  jobFindFirstCalls.length = 0;
  jobFindFirstResult = null;
}

// In-memory RateLimit table for the durable limiter (P1.0 S4 P3):
// mirrors the auth-stub delegate; updateMany only touches unexpired rows.
const rateLimitRows = new Map();

export const prisma = {
  rateLimit: {
    updateMany: async ({ where, data }) => {
      const row = rateLimitRows.get(where?.key);
      if (row && row.resetAt > where?.resetAt?.gt) {
        row.count += data?.count?.increment ?? 1;
        return { count: 1 };
      }
      return { count: 0 };
    },
    upsert: async ({ where, create, update }) => {
      const row = { key: where.key, count: 1, resetAt: (create ?? update).resetAt };
      rateLimitRows.set(where.key, row);
      return row;
    },
    findUnique: async ({ where }) => {
      const row = rateLimitRows.get(where?.key);
      return row ? { count: row.count, resetAt: row.resetAt } : null;
    },
  },
  quote: {
    findFirst: async ({ where }) => {
      if (where?.id === 'quote_1' && where?.businessId === 'biz_1') {
        return {
          id: 'quote_1',
          number: 'Q-0001',
          title: 'QATEST Morning Quote',
          status: 'APPROVED',
          totalCents: 11300n,
          customerId: 'cust_1',
          discountType: null,
          discountValue: null,
          customer: { id: 'cust_1', name: 'QATEST Cust' },
          lineItems: [{ qty: 1, unitPriceCents: 10000n }],
          addons: [],
        };
      }
      return null;
    },
  },
  job: {
    findFirst: async (args) => {
      jobFindFirstCalls.push(args);
      return jobFindFirstResult;
    },
    create: async (args) => {
      createCalls.push(args);
      return { id: 'job_new', ...args.data };
    },
  },
};

export async function requireAuth() {
  return { businessId: 'biz_1', user: { id: 'user_1', name: 'QA Agent' } };
}

export function revalidatePath() {}

export function redirect(url) {
  throw { digest: 'NEXT_REDIRECT', url };
}

/** next/headers: clientKey only reads x-forwarded-for / x-real-ip. */
export async function headers() {
  return { get: () => null };
}
