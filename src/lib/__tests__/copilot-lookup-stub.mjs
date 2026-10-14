/**
 * In-memory stand-in for the modules src/app/api/copilot/route.ts touches,
 * for the lookup GET endpoint tests.
 *
 * - next/server: minimal NextResponse.json
 * - @/lib/prisma: customer/service findMany with tenant-scope capture
 * - @/lib/auth: controllable session
 * - @/lib/i18n/server: getLocale
 *
 * The REAL rate limiter and CSRF check are used (no Origin header in test
 * requests passes checkSameOrigin).
 *
 * M9: also backs src/lib/membership.ts (imported for real by the route) —
 * the stub prisma carries a canned ACTIVE membership row, and it is
 * registered as the tenant-guard's unscoped client so unsafeUnscoped()
 * blocks resolve against it instead of a real database.
 */
import { setUnscopedClient } from '../tenant-guard.ts';

export const calls = {
  customerFindMany: [],
  serviceFindMany: [],
};

const DB = {
  customers: [
    { id: 'c1', businessId: 'biz_1', name: 'Sarah Miller', phone: '5145550101', address: '1 Main St' },
    { id: 'c2', businessId: 'biz_1', name: 'Jean Tremblay', phone: null, address: null },
    { id: 'c3', businessId: 'biz_OTHER', name: 'Other Biz Customer', phone: null, address: null },
  ],
  services: [
    { id: 's1', businessId: 'biz_1', name: 'Furnace repair', price: 299 },
    { id: 's2', businessId: 'biz_OTHER', name: 'Other Biz Service', price: 100 },
  ],
};

let session = { user: { id: 'user_1', businessId: 'biz_1' } };

export function setLookupSession(s) {
  session = s;
}
export function resetLookupStub() {
  calls.customerFindMany.length = 0;
  calls.serviceFindMany.length = 0;
  session = { user: { id: 'user_1', businessId: 'biz_1' } };
}

function pick(row, select) {
  const out = {};
  for (const k of Object.keys(select)) out[k] = row[k];
  return out;
}

export const prisma = {
  // M9: the copilot route resolves the tenant via the ACTIVE membership.
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
    findMany: async (args) => {
      calls.customerFindMany.push(args);
      const q = args.where?.name?.contains?.toLowerCase();
      return DB.customers
        .filter((c) => c.businessId === args.where?.businessId)
        .filter((c) => !q || c.name.toLowerCase().includes(q))
        .slice(0, args.take ?? 8)
        .map((c) => pick(c, args.select));
    },
  },
  service: {
    findMany: async (args) => {
      calls.serviceFindMany.push(args);
      return DB.services
        .filter((s) => s.businessId === args.where?.businessId)
        .slice(0, args.take ?? 12)
        .map((s) => pick(s, args.select));
    },
  },
};

export async function getSession() {
  return session;
}

// Register the stub prisma as the tenant-guard's unscoped client so
// unsafeUnscoped() blocks (e.g. membership lookups by userId) run against
// the in-memory stub instead of throwing "unscoped client not initialized".
setUnscopedClient(prisma);

// M9: requireAuth() now resolves via the ACTIVE membership; the stubbed
// membership row above keeps the canned biz_1 context.
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
