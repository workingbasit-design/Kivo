/**
 * In-memory stand-in for the modules src/app/api/search/route.ts touches,
 * for the GET /api/search endpoint tests.
 *
 * - next/server: minimal NextResponse.json
 * - @/lib/prisma: customer/job/quote/invoice findMany with tenant-scope capture
 * - @/lib/auth: controllable session
 * - @/lib/i18n/server: getLocale
 *
 * The REAL rate limiter and CSRF check are used (no Origin header in test
 * requests passes checkSameOrigin).
 *
 * Also backs src/lib/membership.ts (imported for real by the route) —
 * the stub prisma carries a canned ACTIVE membership row, and it is
 * registered as the tenant-guard's unscoped client so unsafeUnscoped()
 * blocks resolve against it instead of a real database.
 */
import { setUnscopedClient } from '../tenant-guard.ts';

export const calls = {
  customerFindMany: [],
  jobFindMany: [],
  quoteFindMany: [],
  invoiceFindMany: [],
};

const DB = {
  customers: [
    { id: 'c1', businessId: 'biz_1', name: 'Sarah Miller', phone: '5145550101', address: '1 Main St' },
    { id: 'c2', businessId: 'biz_1', name: 'Jean Tremblay', phone: null, address: null },
    { id: 'c3', businessId: 'biz_OTHER', name: 'Other Biz Customer', phone: null, address: null },
  ],
  jobs: [
    { id: 'j1', businessId: 'biz_1', title: 'Furnace tune-up', customer: { name: 'Sarah Miller' } },
    { id: 'j2', businessId: 'biz_1', title: 'AC repair', customer: { name: 'Jean Tremblay' } },
    { id: 'j3', businessId: 'biz_OTHER', title: 'Other Biz Job', customer: { name: 'Other Biz Customer' } },
  ],
  quotes: [
    { id: 'q1', businessId: 'biz_1', number: 'Q-1001', title: 'Furnace tune-up package', customer: { name: 'Sarah Miller' } },
    { id: 'q2', businessId: 'biz_1', number: 'Q-1002', title: 'AC install', customer: { name: 'Jean Tremblay' } },
    { id: 'q3', businessId: 'biz_OTHER', number: 'Q-9001', title: 'Other Biz Quote', customer: { name: 'Other Biz Customer' } },
  ],
  invoices: [
    { id: 'i1', businessId: 'biz_1', number: 'INV-2001', totalCents: 13560, customer: { name: 'Sarah Miller' } },
    { id: 'i2', businessId: 'biz_1', number: 'INV-2002', totalCents: 5000, customer: { name: 'Jean Tremblay' } },
    { id: 'i3', businessId: 'biz_OTHER', number: 'INV-9001', totalCents: 9999, customer: { name: 'Other Biz Customer' } },
  ],
};

let session = { user: { id: 'user_1', businessId: 'biz_1' } };

export function setSearchSession(s) {
  session = s;
}
export function resetSearchStub() {
  calls.customerFindMany.length = 0;
  calls.jobFindMany.length = 0;
  calls.quoteFindMany.length = 0;
  calls.invoiceFindMany.length = 0;
  session = { user: { id: 'user_1', businessId: 'biz_1' } };
}

function pick(row, select) {
  const out = {};
  for (const [k, v] of Object.entries(select)) {
    if (v && typeof v === 'object' && 'select' in v) {
      // Nested relation select, e.g. customer: { select: { name: true } }.
      out[k] = pick(row[k] ?? {}, v.select);
    } else {
      out[k] = row[k];
    }
  }
  return out;
}

/** Match one OR entry from the route's where clause against a stub row. */
function matchesOr(row, cond) {
  for (const [field, spec] of Object.entries(cond)) {
    if (field === 'customer' && spec?.name?.contains) {
      const q = spec.name.contains.toLowerCase();
      if (row.customer?.name?.toLowerCase().includes(q)) return true;
      continue;
    }
    if (spec?.contains !== undefined) {
      const hay = row[field];
      if (typeof hay !== 'string') continue;
      const q = String(spec.contains);
      if (spec.mode === 'insensitive') {
        if (hay.toLowerCase().includes(q.toLowerCase())) return true;
      } else if (hay.includes(q)) {
        return true;
      }
    }
  }
  return false;
}

function runFindMany(rows, args, callLog) {
  callLog.push(args);
  const or = args.where?.OR;
  return rows
    .filter((r) => r.businessId === args.where?.businessId)
    .filter((r) => !or || or.some((cond) => matchesOr(r, cond)))
    .slice(0, args.take ?? 5)
    .map((r) => pick(r, args.select));
}

export const prisma = {
  // getActiveMembershipForUser checks User.activeMembershipId first;
  // the stub user has no override, so the membership fallback applies.
  user: {
    findUnique: async () => ({ activeMembershipId: null }),
  },
  // The search route resolves the tenant via the ACTIVE membership.
  membership: {
    findFirst: async ({ where }) => {
      // Any signed-in stub user has one ACTIVE membership in biz_1.
      if (where?.userId && where?.status === 'ACTIVE') {
        return {
          id: 'mem_1',
          userId: where.userId,
          businessId: 'biz_1',
          role: 'ADMIN',
          status: 'ACTIVE',
        };
      }
      return null;
    },
  },
  customer: {
    findMany: async (args) => runFindMany(DB.customers, args, calls.customerFindMany),
  },
  job: {
    findMany: async (args) => runFindMany(DB.jobs, args, calls.jobFindMany),
  },
  quote: {
    findMany: async (args) => runFindMany(DB.quotes, args, calls.quoteFindMany),
  },
  invoice: {
    findMany: async (args) => runFindMany(DB.invoices, args, calls.invoiceFindMany),
  },
};

export async function getSession() {
  return session;
}

// Register the stub prisma as the tenant-guard's unscoped client so
// unsafeUnscoped() blocks (e.g. membership lookups by userId) run against
// the in-memory stub instead of throwing "unscoped client not initialized".
setUnscopedClient(prisma);

export async function requireAuth() {
  return {
    user: { id: 'user_1' },
    businessId: 'biz_1',
    role: 'ADMIN',
    membershipId: 'mem_1',
  };
}

export async function getLocale() {
  return 'en';
}

export class NextResponse {
  static json(data, init) {
    const body = JSON.stringify(data);
    const res = new Response(body, {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
    res._json = data;
    return res;
  }
}
