/**
 * Persona-configurable stub for @/lib/prisma and @/lib/auth.
 *
 * Personas mirror the E2E seed: ownerA (biz A OWNER), technicianA (biz A
 * TECHNICIAN), ownerB (biz B OWNER), consumer (customer session), anonymous
 * (no session).
 */
let persona = 'anonymous';

export function setPersona(p) {
  persona = p;
}
export function resetMatrixStub() {
  persona = 'anonymous';
}

const MEMBERSHIPS = {
  ownerA: { id: 'mem-a', userId: 'user-a', businessId: 'biz-a', role: 'OWNER', status: 'ACTIVE' },
  adminA: { id: 'mem-aa', userId: 'user-aa', businessId: 'biz-a', role: 'ADMIN', status: 'ACTIVE' },
  dispatcherA: { id: 'mem-da', userId: 'user-da', businessId: 'biz-a', role: 'DISPATCHER', status: 'ACTIVE' },
  technicianA: { id: 'mem-ta', userId: 'user-ta', businessId: 'biz-a', role: 'TECHNICIAN', status: 'ACTIVE' },
  ownerB: { id: 'mem-b', userId: 'user-b', businessId: 'biz-b', role: 'OWNER', status: 'ACTIVE' },
};

const USERS = {
  ownerA: { id: 'user-a', email: 'a@test.ca' },
  adminA: { id: 'user-aa', email: 'aa@test.ca' },
  dispatcherA: { id: 'user-da', email: 'da@test.ca' },
  technicianA: { id: 'user-ta', email: 'ta@test.ca' },
  ownerB: { id: 'user-b', email: 'b@test.ca' },
};

// @/lib/prisma — only membership lookups are stubbed (that's all membership.ts needs).
export const prisma = {
  membership: {
    async findFirst({ where }) {
      const m = MEMBERSHIPS[persona];
      if (!m) return null;
      if (where.userId && where.userId !== m.userId) return null;
      if (where.businessId && where.businessId !== m.businessId) return null;
      if (where.status && where.status !== m.status) return null;
      return m;
    },
    async findMany({ where }) {
      const m = MEMBERSHIPS[persona];
      if (!m) return [];
      if (where.userId && where.userId !== m.userId) return [];
      return [m];
    },
  },
};

// @/lib/auth — requireAuth resolves the persona's session; anonymous throws redirect.
export async function getSession() {
  if (persona === 'anonymous' || persona === 'consumer') return null;
  return { user: USERS[persona] };
}
export async function requireAuth() {
  const session = await getSession();
  if (!session) redirect('/login');
  const m = MEMBERSHIPS[persona];
  if (!m) redirect('/login');
  return { user: session.user, businessId: m.businessId, role: m.role };
}

// next/navigation
export function redirect(url) {
  const e = new Error(`NEXT_REDIRECT ${url}`);
  e.digest = 'NEXT_REDIRECT';
  throw e;
}
