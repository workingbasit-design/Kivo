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
  createCalls.length = 0;
  jobFindFirstCalls.length = 0;
  jobFindFirstResult = null;
}

export const prisma = {
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
