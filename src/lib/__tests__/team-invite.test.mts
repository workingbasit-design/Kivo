/**
 * D1 regression tests (2026-10-21): team invite role validity, atomic
 * user+membership creation, and orphan recovery.
 *
 * The production bug: the invite form submitted role 'MEMBER', which the
 * Membership_role_check DB constraint rejects; the action created the
 * User first with no transaction, leaving an orphan account that could
 * never log in or be re-invited.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs \
 *   src/lib/__tests__/team-invite.test.mts
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

register('./register-loader.mjs', import.meta.url);
register('./team-invite-stub-loader.mjs', import.meta.url);

const { store, control, resetStub } = await import('./team-invite-stub.mjs');
const {
  INVITABLE_ROLES,
  DEFAULT_INVITE_ROLE,
  isInvitableRole,
  roleSatisfiesDbCheck,
  classifyInviteTarget,
  inviteMemberToBusiness,
} = await import('../team-invite.ts');
const { MEMBERSHIP_ROLES } = await import('../membership.ts');

/** Roles allowed by the real DB CHECK, parsed from the m1 migration SQL. */
function dbCheckRoles(): string[] {
  const sql = readFileSync(
    new URL(
      '../../../prisma/migrations/20261014154247_m1_memberships/migration.sql',
      import.meta.url,
    ),
    'utf8',
  );
  const m = /Membership_role_check[\s\S]*?CHECK \("role" IN \(([^)]+)\)\)/.exec(sql);
  assert.ok(m, 'Membership_role_check constraint not found in m1 migration');
  return [...m[1].matchAll(/'([A-Z]+)'/g)].map((x) => x[1]);
}

const BIZ = 'biz-1';
const baseArgs = {
  businessId: BIZ,
  name: 'New Tech',
  email: 'tech@example.ca',
  passwordHash: 'hash-1',
  role: 'TECHNICIAN',
};

describe('D1 invite role validity', () => {
  it('the DB CHECK roles (from the m1 migration) match MEMBERSHIP_ROLES', () => {
    assert.deepEqual([...dbCheckRoles()].sort(), [...MEMBERSHIP_ROLES].sort());
  });

  it('every invitable role satisfies the DB CHECK', () => {
    const legal = dbCheckRoles();
    for (const role of INVITABLE_ROLES) {
      assert.ok(legal.includes(role), `${role} must be allowed by Membership_role_check`);
      assert.equal(roleSatisfiesDbCheck(role), true);
      assert.equal(isInvitableRole(role), true);
    }
  });

  it("'MEMBER' — the value the old form submitted — is neither invitable nor DB-legal", () => {
    assert.equal(isInvitableRole('MEMBER'), false);
    assert.equal(roleSatisfiesDbCheck('MEMBER'), false);
  });

  it("'OWNER' is DB-legal but never invitable", () => {
    assert.equal(roleSatisfiesDbCheck('OWNER'), true);
    assert.equal(isInvitableRole('OWNER'), false);
  });

  it('garbage roles are rejected', () => {
    for (const bad of ['', 'admin', 'SUPERUSER', null, undefined, 42]) {
      assert.equal(isInvitableRole(bad), false, String(bad));
    }
  });

  it('the default invite role is the restricted TECHNICIAN role', () => {
    assert.equal(DEFAULT_INVITE_ROLE, 'TECHNICIAN');
  });
});

describe('D1 classifyInviteTarget', () => {
  it('no user row → new', () => {
    assert.deepEqual(
      classifyInviteTarget({ userId: null, memberships: [], businessId: BIZ }),
      { kind: 'new' },
    );
  });
  it('user with zero memberships → orphan (recoverable)', () => {
    assert.deepEqual(
      classifyInviteTarget({ userId: 'u1', memberships: [], businessId: BIZ }),
      { kind: 'orphan', userId: 'u1' },
    );
  });
  it('ACTIVE membership in this business → already-member', () => {
    assert.deepEqual(
      classifyInviteTarget({
        userId: 'u1',
        memberships: [{ businessId: BIZ, status: 'ACTIVE' }],
        businessId: BIZ,
      }),
      { kind: 'already-member' },
    );
  });
  it('memberships only in other businesses → existing-user', () => {
    assert.deepEqual(
      classifyInviteTarget({
        userId: 'u1',
        memberships: [{ businessId: 'other-biz', status: 'ACTIVE' }],
        businessId: BIZ,
      }),
      { kind: 'existing-user' },
    );
  });
  it('a REMOVED membership here does not count as already-member', () => {
    const t = classifyInviteTarget({
      userId: 'u1',
      memberships: [{ businessId: BIZ, status: 'REMOVED' }],
      businessId: BIZ,
    });
    assert.equal(t.kind, 'existing-user');
  });
});

describe('D1 inviteMemberToBusiness', () => {
  beforeEach(() => resetStub());

  it("role 'MEMBER' is refused BEFORE any row is written", async () => {
    const res = await inviteMemberToBusiness({ ...baseArgs, role: 'MEMBER' });
    assert.equal(res.ok, false);
    assert.equal(store.users.length, 0);
    assert.equal(store.memberships.length, 0);
  });

  it('happy path: user + membership are created with the invited role', async () => {
    const res = await inviteMemberToBusiness(baseArgs);
    assert.equal(res.ok, true);
    assert.equal(store.users.length, 1);
    assert.equal(store.memberships.length, 1);
    const m = store.memberships[0];
    assert.equal(m.userId, store.users[0].id);
    assert.equal(m.businessId, BIZ);
    assert.equal(m.role, 'TECHNICIAN');
    assert.equal(m.status, 'ACTIVE');
    if (res.ok) assert.equal(res.recovered, false);
  });

  it('ADMIN and DISPATCHER invites store their roles verbatim', async () => {
    for (const role of ['ADMIN', 'DISPATCHER']) {
      resetStub();
      const res = await inviteMemberToBusiness({ ...baseArgs, role });
      assert.equal(res.ok, true, role);
      assert.equal(store.memberships[0].role, role);
    }
  });

  it('ATOMICITY: a failed membership insert leaves NO orphan user behind', async () => {
    control.failMembershipCreate = true;
    const res = await inviteMemberToBusiness(baseArgs);
    assert.equal(res.ok, false);
    // The whole point of the fix: the transaction rolled back, so the
    // email is NOT burned — the store is exactly as empty as before.
    assert.equal(store.users.length, 0);
    assert.equal(store.memberships.length, 0);
  });

  it('orphan recovery: a user row with zero memberships is completed, not refused', async () => {
    store.users.push({
      id: 'orphan-1',
      name: 'Half Created',
      email: baseArgs.email,
      passwordHash: 'stale-hash',
    });
    const res = await inviteMemberToBusiness(baseArgs);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.recovered, true);
      assert.equal(res.userId, 'orphan-1');
    }
    // No duplicate user row; the membership now exists and the password
    // the owner just set replaced the stale one.
    assert.equal(store.users.length, 1);
    assert.equal(store.users[0].passwordHash, 'hash-1');
    assert.equal(store.memberships.length, 1);
    assert.equal(store.memberships[0].userId, 'orphan-1');
    assert.equal(store.memberships[0].role, 'TECHNICIAN');
  });

  it('an ACTIVE member of this business is refused without writes', async () => {
    store.users.push({ id: 'u1', name: 'A', email: baseArgs.email, passwordHash: 'h' });
    store.memberships.push({
      id: 'm1',
      userId: 'u1',
      businessId: BIZ,
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    const res = await inviteMemberToBusiness(baseArgs);
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.error, /already on your team/i);
    assert.equal(store.users.length, 1);
    assert.equal(store.memberships.length, 1);
  });

  it("a real account of another business keeps the 'already exists' refusal, no writes", async () => {
    store.users.push({ id: 'u1', name: 'A', email: baseArgs.email, passwordHash: 'h' });
    store.memberships.push({
      id: 'm1',
      userId: 'u1',
      businessId: 'other-biz',
      role: 'OWNER',
      status: 'ACTIVE',
    });
    const res = await inviteMemberToBusiness(baseArgs);
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.error, /already exists/i);
    assert.equal(store.users.length, 1);
    assert.equal(store.memberships.length, 1);
  });
});
