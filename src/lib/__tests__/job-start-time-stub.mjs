/**
 * In-memory stub for the job-start-time test: a fake prisma client, auth,
 * rate limit, logger, and Next.js cache/navigation helpers, plus a capture
 * of every job.update call so the test can assert on the written data.
 *
 * The fixture job is mutable via `db.fixture` (status drives the transition
 * rules); `db.updates` records each prisma.job.update in call order.
 */

export const db = {
  fixture: { id: 'job-1', businessId: 'biz-1', status: 'SCHEDULED' },
  updates: [],
  reset() {
    this.fixture = { id: 'job-1', businessId: 'biz-1', status: 'SCHEDULED' };
    this.updates = [];
  },
};

const jobModel = {
  async findFirst({ where }) {
    if (where && where.id === db.fixture.id && where.businessId === db.fixture.businessId) {
      return { ...db.fixture };
    }
    return null;
  },
  async update({ where, data }) {
    db.updates.push({ where: { ...where }, data: { ...data } });
    Object.assign(db.fixture, data);
    return { ...db.fixture };
  },
};

export const prisma = {
  job: jobModel,
  $transaction: async (fn) => fn({ job: jobModel }),
};

export async function requireAuth() {
  return { businessId: 'biz-1', user: { id: 'user-1' } };
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

export async function headers() {
  return new Headers();
}

export function redirect() {
  throw new Error('redirect() called in test');
}

export async function generatePerVisitInvoice() {}

export async function emitWebhookEvent() {}
