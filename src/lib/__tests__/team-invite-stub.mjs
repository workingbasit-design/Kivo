/**
 * In-memory stub for the D1 team-invite test.
 *
 * Stands in for @/lib/prisma, ./prisma.ts, ./tenant-guard.ts and
 * @/lib/auth (see team-invite-stub-loader.mjs). $transaction is modelled
 * honestly: writes land in a staging copy and are only committed when
 * the callback resolves — a throw discards them (rollback), which is
 * exactly the behaviour the D1 atomicity assertions rely on.
 */
export const store = { users: [], memberships: [] };
export const control = { failMembershipCreate: false, failUserCreate: false };

export function resetStub() {
  store.users = [];
  store.memberships = [];
  control.failMembershipCreate = false;
  control.failUserCreate = false;
}

let seq = 0;

function makeClient(storeRef) {
  return {
    user: {
      async findUnique({ where }) {
        const row = storeRef.users.find((u) => u.email === where.email);
        return row ? { ...row } : null;
      },
      async create({ data }) {
        if (control.failUserCreate) throw new Error('stub: user create failed');
        const row = { id: `user-${++seq}`, ...data };
        storeRef.users.push(row);
        return { ...row };
      },
      async update({ where, data }) {
        const row = storeRef.users.find((u) => u.id === where.id);
        if (!row) throw new Error('stub: user not found');
        Object.assign(row, data);
        return { ...row };
      },
    },
    membership: {
      async findMany({ where }) {
        return storeRef.memberships
          .filter((m) => m.userId === where.userId)
          .map((m) => ({ ...m }));
      },
      async create({ data }) {
        if (control.failMembershipCreate) {
          // Stands in for the DB rejecting the insert (e.g. the
          // Membership_role_check constraint from the original bug).
          throw new Error('stub: membership insert rejected (CHECK constraint)');
        }
        const row = { id: `mem-${++seq}`, ...data };
        storeRef.memberships.push(row);
        return { ...row };
      },
    },
    async $transaction(fn) {
      const staging = {
        users: store.users.map((u) => ({ ...u })),
        memberships: store.memberships.map((m) => ({ ...m })),
      };
      const result = await fn(makeClient(staging));
      store.users = staging.users;
      store.memberships = staging.memberships;
      return result;
    },
  };
}

export const prisma = makeClient(store);

// @/lib/auth stand-in (membership.ts imports requireAuth from it).
export async function requireAuth() {
  return { user: { id: 'stub-admin' } };
}

// ./tenant-guard.ts stand-in: pass the stub client straight through.
export async function unsafeUnscoped(_name, fn) {
  return fn(prisma);
}
