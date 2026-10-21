/**
 * In-memory stand-in for the modules src/app/actions/jobs.ts touches,
 * for the mark-paid wiring tests.
 */
export const calls = {
  jobUpdate: [],
  settle: [],
  transactions: 0,
};

export function resetJobsStub() {
  calls.jobUpdate.length = 0;
  calls.settle.length = 0;
  calls.transactions = 0;
}

function makeTx() {
  return {
    job: {
      update: async (args) => {
        calls.jobUpdate.push(args);
        return { id: args.where.id };
      },
    },
  };
}

export const prisma = {
  job: {
    findFirst: async ({ where }) => {
      if (where?.id === 'job_1' && where?.businessId === 'biz_1')
        return { id: 'job_1', status: 'COMPLETED', customerId: 'cus_1', price: 299 };
      return null;
    },
    update: async (args) => {
      calls.jobUpdate.push(args);
      return { id: args.where.id };
    },
  },
  $transaction: async (fn) => {
    calls.transactions += 1;
    return fn(makeTx());
  },
};

export async function requireAuth() {
  return { businessId: 'biz_1', user: { id: 'user_1' } };
}

export function revalidatePath() {}
export function redirect() {}

// @/lib/validations
export const jobSchema = {};
export const JOB_STATUSES = ['NEW', 'SCHEDULED', 'IN PROGRESS', 'COMPLETED', 'PAID', 'CANCELLED'];

// @/lib/job-status
export function isValidTransition() {
  return true;
}
// Added for D2 (2026-10-21): jobs.ts imports deriveJobWindow to persist
// the scheduled window on create/edit. Faithful mini-implementation of
// the real contract (stored time wins, 60-minute default duration).
export const DEFAULT_JOB_DURATION_MINUTES = 60;
export function deriveJobWindow(job) {
  if (job?.startAt && job?.endAt) return { startAt: job.startAt, endAt: job.endAt };
  const time = typeof job?.time === 'string' ? job.time.trim() : '';
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  if (!job?.date || !m) return { startAt: null, endAt: null };
  const startAt = new Date(job.date);
  startAt.setHours(Number(m[1]), Number(m[2]), 0, 0);
  const duration =
    typeof job?.durationMinutes === 'number' && job.durationMinutes > 0
      ? job.durationMinutes
      : DEFAULT_JOB_DURATION_MINUTES;
  return { startAt, endAt: new Date(startAt.getTime() + duration * 60000) };
}

// @/lib/phone
export function validatePhone() {
  return { ok: true };
}
export const INVALID_PHONE_MESSAGE = 'Invalid phone';

// @/lib/rate-limit
export function rateLimit() {
  return { ok: true };
}
export const ACTION_LIMIT = 100;

// ./invoices (relative import inside jobs.ts)
export async function settleJobPaid(businessId, jobId, tx) {
  calls.settle.push({ businessId, jobId, inTransaction: !!tx });
}
