/**
 * B1.2 role matrix test: requireMembership must allow exactly the roles in
 * the allowlist and reject everything else (wrong role, no membership,
 * inactive membership). Pure logic test with stubbed auth/membership.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./role-matrix-stub-loader.mjs', import.meta.url);

// Shared mutable stub state (imported from the stub module).
const { state } = await import('./role-matrix-stub.mjs');
const { requireMembership } = await import('../membership.ts');

describe('B1.2 role matrix', () => {
  it('OWNER passes an OWNER-only gate', async () => {
    state.role = 'OWNER';
    state.hasMembership = true;
    const r = await requireMembership('biz-1', 'OWNER');
    assert.equal(r.role, 'OWNER');
  });
  it('ADMIN is rejected from an OWNER-only gate', async () => {
    state.role = 'ADMIN';
    state.hasMembership = true;
    await assert.rejects(() => requireMembership('biz-1', 'OWNER'), /role/i);
  });
  it('TECHNICIAN is rejected from an ADMIN gate', async () => {
    state.role = 'TECHNICIAN';
    state.hasMembership = true;
    await assert.rejects(() => requireMembership('biz-1', 'OWNER', 'ADMIN'), /role/i);
  });
  it('DISPATCHER passes a dispatcher-or-admin gate', async () => {
    state.role = 'DISPATCHER';
    state.hasMembership = true;
    const r = await requireMembership('biz-1', 'ADMIN', 'DISPATCHER');
    assert.equal(r.role, 'DISPATCHER');
  });
  it('no membership → rejected (anonymous / wrong business)', async () => {
    state.role = 'OWNER';
    state.hasMembership = false;
    await assert.rejects(() => requireMembership('biz-1', 'OWNER'), /access/i);
  });
  it('empty allowlist means "any active member"', async () => {
    state.role = 'TECHNICIAN';
    state.hasMembership = true;
    const r = await requireMembership('biz-1');
    assert.equal(r.role, 'TECHNICIAN');
  });
});
