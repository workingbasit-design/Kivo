/**
 * P1.0 (audit slice B, B-6): suspend/unsuspend + role-change for team members.
 *
 * Static tests in the established style for settings actions (the existing
 * settings tests are static too — the actions need a session + Prisma, so
 * there is no stub harness for them). Each test pins a guard that must not
 * regress: admin-only, self-guard, last-admin guard, tenant-scoped
 * updateMany + count check, session invalidation, and the team page
 * listing suspended members so they can be unsuspended.
 *
 * Live-verify (real admin + real member, /settings/team): suspend locks
 * the member out (session ended), unsuspend restores sign-in, role change
 * applies on next sign-in.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

function src(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function fnBody(code, name) {
  const start = code.indexOf(`export async function ${name}`);
  assert.ok(start !== -1, `${name} must exist`);
  // Next exported function or end of file bounds the body.
  const next = code.indexOf('\nexport async function', start + 10);
  const nextDoc = code.indexOf('\n/**', start + 10);
  const end = Math.min(
    next === -1 ? Infinity : next,
    nextDoc === -1 ? Infinity : nextDoc,
    code.length,
  );
  return code.slice(start, end);
}

describe('suspendTeamMember', () => {
  const code = src('app/actions/settings.ts');
  const body = fnBody(code, 'suspendTeamMember');
  it('is admin-only, rate-limited, and refuses self-suspend', () => {
    assert.ok(body.includes('requireAdminRole(callerRole)'));
    assert.ok(body.includes("limited(`team:${businessId}`)"));
    assert.ok(body.includes("if (id === user.id)"));
    assert.ok(body.includes('You cannot suspend yourself.'));
  });

  it('refuses to suspend the last admin', () => {
    assert.ok(body.includes("target.role === 'ADMIN'"));
    assert.ok(body.includes("where: { businessId, role: 'ADMIN', status: 'ACTIVE' }"));
    assert.ok(body.includes('Cannot suspend the last admin.'));
  });

  it('flips ACTIVE → SUSPENDED via tenant-scoped updateMany + count check, then ends sessions', () => {
    assert.ok(body.includes("where: { id: target.id, businessId, status: 'ACTIVE' }"));
    assert.ok(body.includes("data: { status: 'SUSPENDED' }"));
    assert.ok(body.includes('if (updated.count === 0)'));
    assert.ok(body.includes('invalidateUserSessions(id)'));
    assert.ok(body.includes("revalidatePath('/settings/team')"));
  });
});

describe('unsuspendTeamMember', () => {
  const code = src('app/actions/settings.ts');
  const body = fnBody(code, 'unsuspendTeamMember');
  it('is admin-only and restores SUSPENDED → ACTIVE via tenant-scoped updateMany', () => {
    assert.ok(body.includes('requireAdminRole(callerRole)'));
    assert.ok(body.includes("where: { userId: id, businessId, status: 'SUSPENDED' }"));
    assert.ok(body.includes("data: { status: 'ACTIVE' }"));
    assert.ok(body.includes('if (updated.count === 0)'));
    assert.ok(body.includes("revalidatePath('/settings/team')"));
  });
});

describe('changeTeamMemberRole', () => {
  const code = src('app/actions/settings.ts');
  const body = fnBody(code, 'changeTeamMemberRole');
  it('validates the role, refuses self-change and last-admin demotion', () => {
    assert.ok(body.includes('isInvitableRole(role)'));
    assert.ok(body.includes('You cannot change your own role.'));
    assert.ok(body.includes("target.role === 'ADMIN' && role !== 'ADMIN'"));
    assert.ok(body.includes('Cannot demote the last admin.'));
  });

  it('writes via tenant-scoped updateMany + count check, then ends sessions', () => {
    assert.ok(body.includes("where: { id: target.id, businessId, status: 'ACTIVE' }"));
    assert.ok(body.includes('data: { role }'));
    assert.ok(body.includes('if (updated.count === 0)'));
    assert.ok(body.includes('invalidateUserSessions(id)'));
  });
});

describe('team page + client wiring', () => {
  it('the page lists ACTIVE and SUSPENDED members (so suspended can be unsuspended)', () => {
    const page = src('app/(app)/settings/team/page.tsx');
    assert.ok(page.includes("status: { in: ['ACTIVE', 'SUSPENDED'] }"));
    assert.ok(page.includes('status: m.status'));
  });

  it('the client wires suspend / unsuspend / role change', () => {
    const client = src('components/TeamClient.tsx');
    assert.ok(client.includes('suspendTeamMember'));
    assert.ok(client.includes('unsuspendTeamMember'));
    assert.ok(client.includes('changeTeamMemberRole'));
    assert.ok(client.includes("t('t10misc.team.suspend')"));
    assert.ok(client.includes("t('t10misc.team.unsuspend')"));
    assert.ok(client.includes("t('t10misc.team.suspended')"));
  });
});

describe('team i18n keys exist in EN and FR', () => {
  it('every new key is present in both dictionaries', () => {
    const misc = src('lib/i18n/fragments/track10-misc.ts');
    const lines = misc.split('\n');
    for (const key of [
      'suspend:',
      'unsuspend:',
      'suspended:',
      'suspendTitle:',
      'suspendMessage:',
      'suspendConfirm:',
      'suspendedToast:',
      'unsuspendTitle:',
      'unsuspendMessage:',
      'unsuspendConfirm:',
      'unsuspendedToast:',
      'roleChanged:',
    ]) {
      // Line-start match: 'suspend:' is a substring of 'unsuspend:'.
      const occurrences = lines.filter((l) => l.trimStart().startsWith(key)).length;
      assert.equal(occurrences, 2, `${key} must appear once in EN and once in FR`);
    }
  });
});
