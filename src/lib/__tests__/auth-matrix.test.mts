/**
 * P4-A-003 — Authorization matrix: server actions.
 *
 * P4-A-003a (static): every src/app/actions/*.ts file must call an auth
 * function (requireAuth/getSession/requireMembership/customer auth) or be on
 * the PUBLIC_ALLOWLIST. Catches accidentally-unauthenticated actions.
 *
 * P4-A-003b (dynamic): requireMembership across personas — anonymous throws,
 * wrong business throws, wrong role throws, correct role passes.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIONS_DIR = join(HERE, '..', '..', 'app', 'actions');

/** Actions intentionally callable without a session. */
const PUBLIC_ALLOWLIST = new Set([
  'customer-auth.ts', // login/signup/logout
  'password-reset.ts', // request/reset (token-gated)
  'booking-slots.ts', // public booking page
]);

const AUTH_CALLS = /requireAuth|getSession|requireMembership|requireCustomer|getCustomerSession|CustomerSession/;

describe('P4-A-003a: every server action is authenticated or allowlisted', () => {
  const files = readdirSync(ACTIONS_DIR).filter((f) => f.endsWith('.ts'));
  assert.ok(files.length > 50, `expected 50+ action files, got ${files.length}`);
  for (const file of files) {
    const src = readFileSync(join(ACTIONS_DIR, file), 'utf8');
    if (!/^'use server'/m.test(src)) continue;
    const hasAuth = AUTH_CALLS.test(src);
    assert.ok(
      hasAuth || PUBLIC_ALLOWLIST.has(file),
      `${file}: no auth call and not on PUBLIC_ALLOWLIST`,
    );
  }
  test('allowlist stays minimal', () => {
    assert.ok(PUBLIC_ALLOWLIST.size <= 5, 'allowlist is growing — review each addition');
  });
});

describe('P4-A-003b: requireMembership across personas', () => {
  register('./register-loader.mjs', import.meta.url);
  register('./auth-matrix-stub-loader.mjs', import.meta.url);

  let membership;
  let stub;
  before(async () => {
    membership = await import('../membership.ts');
    stub = await import('./auth-matrix-stub.mjs');
  });

  // Use lazy test definition after imports resolve.
  test('anonymous (no session) -> throws redirect', async () => {
    const { requireMembership } = membership;
    stub.setPersona('anonymous');
    await assert.rejects(
      requireMembership('biz-a', 'OWNER'),
      (e) => e.digest === 'NEXT_REDIRECT',
    );
  });

  test('ownerB asking for biz-a -> "no access to this business"', async () => {
    const { requireMembership } = membership;
    stub.setPersona('ownerB');
    await assert.rejects(
      requireMembership('biz-a', 'OWNER'),
      /do not have access to this business/,
    );
  });

  test('ownerB asking for own biz-b -> passes', async () => {
    const { requireMembership } = membership;
    stub.setPersona('ownerB');
    const r = await requireMembership('biz-b', 'OWNER');
    assert.equal(r.businessId, 'biz-b');
    assert.equal(r.role, 'OWNER');
  });

  test('technicianA on OWNER-only action -> role rejected', async () => {
    const { requireMembership } = membership;
    stub.setPersona('technicianA');
    await assert.rejects(requireMembership('biz-a', 'OWNER', 'ADMIN'), /role does not allow/);
  });

  test('technicianA on technician-allowed action -> passes', async () => {
    const { requireMembership } = membership;
    stub.setPersona('technicianA');
    const r = await requireMembership('biz-a', 'TECHNICIAN', 'DISPATCHER', 'ADMIN', 'OWNER');
    assert.equal(r.role, 'TECHNICIAN');
  });

  test('dispatcherA on dispatcher-allowed action -> passes; on owner-only -> rejected', async () => {
    const { requireMembership } = membership;
    stub.setPersona('dispatcherA');
    const r = await requireMembership('biz-a', 'DISPATCHER');
    assert.equal(r.role, 'DISPATCHER');
    await assert.rejects(requireMembership('biz-a', 'OWNER'), /role does not allow/);
  });

  test('consumer (no business session) -> throws redirect', async () => {
    const { requireMembership } = membership;
    stub.setPersona('consumer');
    await assert.rejects(
      requireMembership('biz-a', 'OWNER'),
      (e) => e.digest === 'NEXT_REDIRECT',
    );
  });
});
