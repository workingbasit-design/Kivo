/**
 * In-memory stand-in for the modules src/app/actions/invoices.ts touches,
 * for the D4 invoice↔job link tests. Records the transaction writes so
 * the tests can assert exactly what createInvoice persisted.
 */
export const calls = {
  invoiceCreate: [],
  lineItemCreateMany: [],
  jobUpdate: [],
  auditEventCreate: [],
};

export const store = {
  // job_1 belongs to cus_1 in biz_1 and has never been invoiced.
  jobs: [
    { id: 'job_1', businessId: 'biz_1', customerId: 'cus_1', invoicedAt: null },
    // job_2 belongs to a different customer.
    { id: 'job_2', businessId: 'biz_1', customerId: 'cus_2', invoicedAt: null },
    // job_3 was already invoiced once (invoicedAt set).
    {
      id: 'job_3',
      businessId: 'biz_1',
      customerId: 'cus_1',
      invoicedAt: new Date('2026-10-01T00:00:00Z'),
    },
    // job_4 belongs to another business.
    { id: 'job_4', businessId: 'biz_2', customerId: 'cus_1', invoicedAt: null },
  ],
  customers: [
    { id: 'cus_1', businessId: 'biz_1' },
    { id: 'cus_2', businessId: 'biz_1' },
  ],
};

export function resetInvoiceLinkStub() {
  rateLimitRows.clear();
  calls.invoiceCreate.length = 0;
  calls.lineItemCreateMany.length = 0;
  calls.jobUpdate.length = 0;
  calls.auditEventCreate.length = 0;
}

function findJob({ where }) {
  const job = store.jobs.find(
    (j) => j.id === where.id && j.businessId === where.businessId,
  );
  return job ? { ...job } : null;
}

function makeTx() {
  return {
    // nextDocumentNumber() (M4) uses raw SQL inside the transaction.
    $executeRaw: async () => 1,
    $queryRaw: async () => [{ nextNumber: 1, prefix: 'INV-', padding: 4 }],
    invoice: {
      create: async ({ data }) => {
        calls.invoiceCreate.push(data);
        return { id: 'inv_new', totalCents: BigInt(0), ...data };
      },
    },
    invoiceLineItem: {
      createMany: async ({ data }) => {
        calls.lineItemCreateMany.push(data);
        return { count: data.length };
      },
    },
    job: {
      update: async (args) => {
        calls.jobUpdate.push(args);
        return { id: args.where.id };
      },
    },
    // F1a: createInvoice audits MONEY_CREATE inside the same tx.
    auditEvent: {
      create: async ({ data }) => {
        calls.auditEventCreate.push(data);
        return { id: 'audit_1', ...data };
      },
    },
  };
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
  $transaction: async (fn) => fn(makeTx()),
  customer: {
    findFirst: async ({ where }) => {
      const c = store.customers.find(
        (x) => x.id === where.id && x.businessId === where.businessId,
      );
      return c ? { id: c.id } : null;
    },
  },
  job: {
    findFirst: async (args) => findJob(args),
  },
  business: {
    findUnique: async () => ({ regionCode: 'CA', taxRegion: 'ON' }),
  },
};

export async function requireAuth() {
  return { businessId: 'biz_1', user: { id: 'user_1' } };
}

export function revalidatePath() {}
export function redirect() {}
export function headers() {
  return { get: () => null };
}
