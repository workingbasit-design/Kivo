/**
 * In-memory stub for the customer-options jobs test (2026-11-08 deep test).
 *
 * Simulates the /api/customers/options backing data: two businesses, four
 * jobs. The stub's job.findMany enforces the route's where clause exactly
 * like the real query would - businessId + COMPLETED + invoices none -
 * so a job that already has a linked invoice is never offered as linkable.
 */
export const calls = { jobFindMany: [] };

let sessionBusinessId = 'biz-1';
let sessionOn = true;

export function setSessionBusinessId(id) {
  sessionBusinessId = id;
}
export function setSessionOn(on) {
  sessionOn = on;
}
export function resetStub() {
  calls.jobFindMany.length = 0;
  sessionBusinessId = 'biz-1';
  sessionOn = true;
}

const CUSTOMERS = [
  { id: 'cus-1', name: 'Cust One', businessId: 'biz-1' },
  { id: 'cus-2', name: 'Cust Two', businessId: 'biz-2' },
];

const PROPERTIES = [
  { id: 'prop-1', customerId: 'cus-1', label: 'Home', address: '1 Main St', province: 'ON', businessId: 'biz-1' },
];

// invoiceIds models the Job.invoices relation: a job with any entry here
// already has a linked invoice and must NOT be offered as linkable.
const JOBS = [
  { id: 'job-1', customerId: 'cus-1', title: 'Completed, uninvoiced', date: new Date('2026-11-08T00:00:00Z'), businessId: 'biz-1', status: 'COMPLETED', invoiceIds: [] },
  { id: 'job-2', customerId: 'cus-1', title: 'Completed, already invoiced', date: new Date('2026-11-07T00:00:00Z'), businessId: 'biz-1', status: 'COMPLETED', invoiceIds: ['inv-9'] },
  { id: 'job-3', customerId: 'cus-1', title: 'Scheduled, uninvoiced', date: new Date('2026-11-08T00:00:00Z'), businessId: 'biz-1', status: 'SCHEDULED', invoiceIds: [] },
  { id: 'job-4', customerId: 'cus-2', title: 'Other business completed', date: new Date('2026-11-08T00:00:00Z'), businessId: 'biz-2', status: 'COMPLETED', invoiceIds: [] },
];

function applyJobWhere(where) {
  return JOBS.filter((j) => {
    if (where.businessId && j.businessId !== where.businessId) return false;
    if (where.status && j.status !== where.status) return false;
    if (where.invoices && 'none' in where.invoices && j.invoiceIds.length > 0) return false;
    return true;
  });
}

export const prisma = {
  customer: {
    findMany: async ({ where }) => CUSTOMERS.filter((c) => !where?.businessId || c.businessId === where.businessId),
  },
  customerProperty: {
    findMany: async ({ where }) => PROPERTIES.filter((p) => !where?.businessId || p.businessId === where.businessId),
  },
  job: {
    findMany: async (args) => {
      calls.jobFindMany.push(args?.where ?? null);
      const rows = applyJobWhere(args?.where ?? {});
      const select = args?.select ?? {};
      // Mirror the route's select: id, customerId, title, date only.
      return rows.map((j) => {
        const out = {};
        for (const k of Object.keys(select)) if (select[k]) out[k] = j[k];
        return out;
      });
    },
  },
};

export async function getSession() {
  return sessionOn ? { user: { id: 'user-1' } } : null;
}

export async function getActiveMembershipForUser() {
  return sessionOn ? { businessId: sessionBusinessId, role: 'OWNER' } : null;
}

export class NextResponse {
  static json(data, init) {
    return { status: init?.status ?? 200, data };
  }
}
