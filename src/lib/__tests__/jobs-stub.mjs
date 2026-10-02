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
