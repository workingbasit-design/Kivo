/**
 * Test-only in-memory stand-in for the modules
 * src/app/actions/customer-requests.ts touches:
 * - @/lib/prisma (business.findFirst, quoteRequest.findFirst/create, lead.create, $transaction)
 * - @/lib/customer-auth (getCustomerSession)
 * - next/navigation (redirect)
 * - next/cache (revalidatePath)
 * - @/lib/rate-limit (real one is used - in-memory, fine)
 * - @/lib/lead-expiry (real one - pure date math)
 */
export const calls = { quoteRequests: [], leads: [], revalidated: [], dismissed: [] };

// Seeded businesses: one verified+opted-in, one opted-out, one unverified.
export const businesses = new Map([
  ['biz_ok', { id: 'biz_ok', name: 'OK Plumbing', directoryOptIn: true, directoryVerifiedAt: new Date() }],
  ['biz_out', { id: 'biz_out', name: 'Opted Out', directoryOptIn: false, directoryVerifiedAt: new Date() }],
  ['biz_unv', { id: 'biz_unv', name: 'Unverified', directoryOptIn: true, directoryVerifiedAt: null }],
]);

export function resetCalls() {
  calls.quoteRequests.length = 0;
  calls.leads.length = 0;
  calls.revalidated.length = 0;
  calls.dismissed.length = 0;
  resetDirectoryRequests();
}

// Open-lead drafts for the withdraw tests: one OPEN owned by the signed-in
// customer, one OPEN owned by someone else, one already DISMISSED.
export const directoryRequests = new Map();
export function resetDirectoryRequests() {
  directoryRequests.clear();
  directoryRequests.set('dr_open_mine', { id: 'dr_open_mine', customerId: 'cust_1', status: 'OPEN' });
  directoryRequests.set('dr_open_other', { id: 'dr_open_other', customerId: 'cust_2', status: 'OPEN' });
  directoryRequests.set('dr_done_mine', { id: 'dr_done_mine', customerId: 'cust_1', status: 'DISMISSED' });
}
resetDirectoryRequests();

function txStub() {
  return {
    quoteRequest: {
      create: async ({ data }) => {
        const row = { id: `qr_${calls.quoteRequests.length + 1}`, ...data };
        calls.quoteRequests.push(row);
        return row;
      },
    },
    lead: {
      create: async ({ data }) => {
        const row = { id: `lead_${calls.leads.length + 1}`, ...data };
        calls.leads.push(row);
        return row;
      },
    },
  };
}

export const prisma = {
  business: {
    // Faithful emulation: honors the where-clause filters the action passes.
    findFirst: async ({ where }) => {
      const b = businesses.get(where.id);
      if (!b) return null;
      if (where.directoryOptIn === true && b.directoryOptIn !== true) return null;
      if (where.directoryVerifiedAt && 'not' in where.directoryVerifiedAt) {
        if (b.directoryVerifiedAt == null) return null;
      }
      return { id: b.id, name: b.name };
    },
  },
  quoteRequest: {
    findFirst: async () => null, // no recent duplicate in these tests
  },
  directoryRequest: {
    // Faithful emulation of updateMany: only a row matching id +
    // customerId + status is touched; anything else is a silent no-op.
    updateMany: async ({ where, data }) => {
      const row = directoryRequests.get(where.id);
      if (!row) return { count: 0 };
      if (row.customerId !== where.customerId) return { count: 0 };
      if (row.status !== where.status) return { count: 0 };
      row.status = data.status;
      calls.dismissed.push(row.id);
      return { count: 1 };
    },
  },
  $transaction: async (fn) => fn(txStub()),
};

export function getCustomerSession() {
  if (currentCustomerId == null) return null;
  return {
    customer: {
      id: currentCustomerId,
      name: 'Alex Carter',
      phone: '(416) 555-0132',
      email: 'alex@example.com',
      city: 'Toronto',
    },
  };
}

export function revalidatePath(path) {
  calls.revalidated.push(path);
}

let currentCustomerId = 'cust_1';
export function setCustomerId(id) {
  currentCustomerId = id;
}

export function redirect(url) {
  const e = new Error(`REDIRECT:${url}`);
  e.digest = 'NEXT_REDIRECT';
  throw e;
}
