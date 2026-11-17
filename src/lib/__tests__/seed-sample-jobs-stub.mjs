/**
 * In-memory stub for the seed-sample-jobs test: a fake prisma client, auth,
 * rate limit, logger, and Next.js cache/navigation/headers helpers, plus a
 * capture of every created customer/job so the test can assert nothing was
 * written for a blocked production business.
 *
 * `db.demo` drives Business.isDemo; `db.jobCount` drives Job.count (the
 * zero-jobs precondition); `db.customers` / `db.jobs` record creates.
 */

export const db = {
  demo: false,
  jobCount: 0,
  customers: [],
  jobs: [],
  reset() {
    this.demo = false;
    this.jobCount = 0;
    this.customers = [];
    this.jobs = [];
  },
};

const businessModel = {
  async findUnique() {
    return { isDemo: db.demo };
  },
};

const jobModel = {
  async count() {
    return db.jobCount;
  },
  async create({ data }) {
    const row = { id: `job-${db.jobs.length + 1}`, ...data };
    db.jobs.push(row);
    return row;
  },
};

const customerModel = {
  async findFirst() {
    return db.customers[0] ?? null;
  },
  async create({ data }) {
    const row = { id: `cust-${db.customers.length + 1}`, ...data };
    db.customers.push(row);
    return row;
  },
};

export const prisma = {
  business: businessModel,
  job: jobModel,
  customer: customerModel,
  $transaction: async (fn) => fn(prisma),
};

export async function requireAuth() {
  return { businessId: 'biz-1', user: { id: 'user-1' } };
}

// B-8: jobs.ts imports requireMembership (deleteJob gate). The stub
// persona is the business owner, so the check always passes.
export async function requireMembership(businessId, ...allowedRoles) {
  return { userId: 'user-1', businessId, role: 'OWNER', membershipId: 'mem-1' };
}

export function rateLimit() {
  return { ok: true, remaining: 120, retryAfterMs: 0 };
}

export const ACTION_LIMIT = { limit: 120, windowMs: 60 * 1000 };

export const logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export function revalidatePath() {}

export function redirect() {
  throw new Error('redirect() called in test');
}

export async function headers() {
  return new Headers();
}

export async function generatePerVisitInvoice() {}

export async function emitWebhookEvent() {}
