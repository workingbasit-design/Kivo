/**
 * Regression pins for the 2026-11-06 architect deep test.
 *
 * Three live breaks shared one root cause — tenant-owned queries without a
 * top-level where.businessId, which the fail-closed guard rejects with
 * TenantScopeError:
 *  1. settings.ts removeTeamMember: membership.delete({ where: { id } })
 *     → team-member removal broken.
 *  2. messaging.ts verifyBusinessEmailToken: emailVerificationToken
 *     findUnique/update by token hash only → the public /verify-email flow
 *     hit the error boundary; emailVerifiedAt never stamped.
 *  3. error-log.ts reportError/reportLoginFailure: errorLog findFirst/
 *     update/create without businessId → nothing ever persisted (and the
 *     cron error-alerts reader threw on the same shapes), so brute-force
 *     alerting was blind.
 *
 * These tests pin the guard behaviour each fix relies on: the fixed
 * (scoped) shapes must pass, and the broken (unscoped) shapes must still
 * fail closed — so a future edit that drops the scope fails the suite
 * instead of breaking the feature silently in production.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/deep-test-20261106-guard.test.mts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertTenantScope, TenantScopeError } from '../tenant-guard.ts';

describe('2026-11-06 deep-test fixes: fixed shapes pass the guard', () => {
  it('removeTeamMember: membership.deleteMany with { id, businessId } passes', () => {
    assert.doesNotThrow(() =>
      assertTenantScope({
        model: 'Membership',
        action: 'deleteMany',
        args: { where: { id: 'mem_1', businessId: 'biz_1' } },
      })
    );
  });

  it('recordPayment row lock: invoice.updateMany with { id, businessId } passes', () => {
    assert.doesNotThrow(() =>
      assertTenantScope({
        model: 'Invoice',
        action: 'updateMany',
        args: { where: { id: 'inv_1', businessId: 'biz_1' } },
      })
    );
  });

  it('errorLog: scoped findFirst/updateMany/create pass when businessId is known', () => {
    assert.doesNotThrow(() =>
      assertTenantScope({
        model: 'ErrorLog',
        action: 'findFirst',
        args: { where: { fingerprint: 'fp', kind: 'error', businessId: 'biz_1' } },
      })
    );
    assert.doesNotThrow(() =>
      assertTenantScope({
        model: 'ErrorLog',
        action: 'updateMany',
        args: { where: { id: 'err_1', businessId: 'biz_1' } },
      })
    );
    assert.doesNotThrow(() =>
      assertTenantScope({
        model: 'ErrorLog',
        action: 'create',
        args: { data: { fingerprint: 'fp', kind: 'error', message: 'boom', businessId: 'biz_1' } },
      })
    );
  });

  it('messagingConnection update via the { businessId_channel } compound key passes', () => {
    assert.doesNotThrow(() =>
      assertTenantScope({
        model: 'MessagingConnection',
        action: 'update',
        args: {
          where: { businessId_channel: { businessId: 'biz_1', channel: 'EMAIL' } },
        },
      })
    );
  });
});

describe('2026-11-06 deep-test fixes: broken shapes still fail closed', () => {
  it('removeTeamMember (old): membership.delete by id only is blocked', () => {
    assert.throws(
      () =>
        assertTenantScope({
          model: 'Membership',
          action: 'delete',
          args: { where: { id: 'mem_1' } },
        }),
      TenantScopeError
    );
  });

  it('verifyBusinessEmailToken (old): token-hash-only lookup is blocked — that is why the fix routes it through unsafeUnscoped', () => {
    assert.throws(
      () =>
        assertTenantScope({
          model: 'EmailVerificationToken',
          action: 'findUnique',
          args: { where: { tokenHash: 'abc123' } },
        }),
      TenantScopeError
    );
    assert.throws(
      () =>
        assertTenantScope({
          model: 'EmailVerificationToken',
          action: 'update',
          args: { where: { id: 'tok_1' } },
        }),
      TenantScopeError
    );
  });

  it('errorLog (old): unscoped findFirst/update/create are blocked — that is why platform rows go through unsafeUnscoped', () => {
    assert.throws(
      () =>
        assertTenantScope({
          model: 'ErrorLog',
          action: 'findFirst',
          args: { where: { fingerprint: 'fp', kind: 'login_failure' } },
        }),
      TenantScopeError
    );
    assert.throws(
      () =>
        assertTenantScope({
          model: 'ErrorLog',
          action: 'update',
          args: { where: { id: 'err_1' } },
        }),
      TenantScopeError
    );
    assert.throws(
      () =>
        assertTenantScope({
          model: 'ErrorLog',
          action: 'create',
          args: { data: { fingerprint: 'fp', kind: 'login_failure', message: 'x' } },
        }),
      TenantScopeError
    );
  });
});
