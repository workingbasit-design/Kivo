/**
 * In-memory stand-in for the modules src/app/actions/invoices.ts touches,
 * for the settle-job-paid tests. Exposes a fake transaction client whose
 * calls are recorded for assertions.
 */
export const calls = {
  invoiceCreate: [],
  lineItemCreate: [],
  paymentCreate: [],
  invoiceUpdate: [],
};

export function resetSettleStub() {
  calls.invoiceCreate.length = 0;
  calls.lineItemCreate.length = 0;
  calls.paymentCreate.length = 0;
  calls.invoiceUpdate.length = 0;
}

// Scenario data, swapped per test.
let scenario = 'no-invoice';
export function setScenario(s) {
  scenario = s;
}

const JOB = { id: 'job_1', price: 299, title: 'Test job', customerId: 'cus_1' };

export function makeTx() {
  return {
    job: {
      findFirst: async ({ where }) => {
        if (where?.id === 'job_1' && where?.businessId === 'biz_1') return { ...JOB };
        return null;
      },
    },
    invoice: {
      findFirst: async () => null, // no number clash in tests
      findMany: async ({ where }) => {
        if (where?.jobId !== 'job_1' || where?.businessId !== 'biz_1') return [];
        if (scenario === 'no-invoice') return [];
        if (scenario === 'open-invoice')
          return [{ id: 'inv_1', total: 299, payments: [{ amount: 100 }] }];
        if (scenario === 'paid-invoice')
          return [{ id: 'inv_1', total: 299, payments: [{ amount: 299 }] }];
        return [];
      },
      create: async ({ data }) => {
        calls.invoiceCreate.push(data);
        return { id: 'inv_new', ...data };
      },
      update: async (args) => {
        calls.invoiceUpdate.push(args);
        return { id: args.where.id };
      },
    },
    invoiceLineItem: {
      create: async ({ data }) => {
        calls.lineItemCreate.push(data);
        return { id: 'li_1', ...data };
      },
    },
    payment: {
      create: async ({ data }) => {
        calls.paymentCreate.push(data);
        return { id: 'pay_1', ...data };
      },
    },
  };
}

export const prisma = {
  $transaction: async (fn) => fn(makeTx()),
};

export async function requireAuth() {
  return { businessId: 'biz_1', user: { id: 'user_1' } };
}

export function revalidatePath() {}
export function redirect() {}
export function headers() {
  return { get: () => null };
}
