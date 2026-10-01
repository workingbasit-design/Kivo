/**
 * In-memory stand-in for the modules src/app/actions/imports.ts touches.
 * Heavy google-* modules load for real (import-time side-effect free);
 * only auth/prisma/cache/locale are stubbed.
 */
export const db = {
  customers: [
    { id: 'cust_1', businessId: 'biz_1', name: 'Marie Tremblay', phone: '(514) 555-0100', phoneNorm: '15145550100', email: null },
  ],
  jobs: [],
  createdCustomers: [],
  createdJobs: [],
};

export function resetDb() {
  db.jobs.length = 0;
  db.createdCustomers.length = 0;
  db.createdJobs.length = 0;
}

export const prisma = {
  customer: {
    findMany: async ({ where, select }) => {
      return db.customers
        .filter((c) => !where?.businessId || c.businessId === where.businessId)
        .map((c) => {
          const row = {};
          for (const k of Object.keys(select ?? {})) row[k] = c[k] ?? null;
          return row;
        });
    },
    createMany: async ({ data }) => {
      for (const d of data) {
        db.createdCustomers.push(d);
        db.customers.push({ id: `cust_new_${db.customers.length}`, ...d });
      }
      return { count: data.length };
    },
  },
  job: {
    findMany: async ({ where }) => {
      return db.jobs.filter((j) => !where?.businessId || j.businessId === where.businessId);
    },
    createMany: async ({ data }) => {
      for (const d of data) db.createdJobs.push(d);
      // Mirror into db.jobs so the dedupe guard sees them on re-import.
      for (const d of data) {
        db.jobs.push({ businessId: d.businessId, customerId: d.customerId, title: d.title, date: d.date });
      }
      return { count: data.length };
    },
  },
};

export function requireAuth() {
  return { businessId: 'biz_1', user: { id: 'user_import_test' } };
}

export function revalidatePath() {}

export function getLocale() {
  return 'en';
}
