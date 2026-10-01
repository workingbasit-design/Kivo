/**
 * Regression tests for the 2026-10-01 /settings/messaging production crash.
 *
 * getMessagingOverview() (src/lib/messaging/engine.ts) upserts the monthly
 * MessageQuota row via the compound unique key
 *   { businessId_month: { businessId, month } }
 * and connectWhatsAppAction/connectEmailAction (src/app/actions/messaging.ts)
 * upsert MessagingConnection rows via
 *   { businessId_channel: { businessId, channel } }.
 * Prisma requires the compound input for upsert/findUnique, so there is no
 * top-level where.businessId — and the fail-closed tenant guard threw
 * TenantScopeError, crashing the page to the error boundary on every load
 * (and breaking the messaging scheduler + WhatsApp webhook quota path).
 *
 * These tests pin the guard's compound-key exemption: compound uniques that
 * embed a non-empty businessId are tenant-scoped and must pass; compounds
 * without one must still fail closed.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/messaging-tenant-scope.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);

const { assertTenantScope, TenantScopeError } = await import('../tenant-guard.ts');

test('MessageQuota upsert via { businessId_month } passes the guard', () => {
  assert.doesNotThrow(() =>
    assertTenantScope({
      model: 'MessageQuota',
      action: 'upsert',
      args: {
        where: { businessId_month: { businessId: 'biz_1', month: '2026-10' } },
        create: { businessId: 'biz_1', month: '2026-10' },
        update: {},
      },
    }),
  );
});

test('MessagingConnection upsert via { businessId_channel } passes the guard', () => {
  for (const channel of ['WHATSAPP', 'EMAIL']) {
    assert.doesNotThrow(() =>
      assertTenantScope({
        model: 'MessagingConnection',
        action: 'upsert',
        args: {
          where: { businessId_channel: { businessId: 'biz_1', channel } },
          create: { businessId: 'biz_1', channel },
          update: {},
        },
      }),
    );
  }
});

test('compound key with empty businessId still fails closed', () => {
  assert.throws(
    () =>
      assertTenantScope({
        model: 'MessageQuota',
        action: 'upsert',
        args: { where: { businessId_month: { businessId: '', month: '2026-10' } } },
      }),
    TenantScopeError,
  );
});

test('compound key without businessId still fails closed', () => {
  assert.throws(
    () =>
      assertTenantScope({
        model: 'MessageQuota',
        action: 'upsert',
        args: { where: { businessId_month: { month: '2026-10' } } },
      }),
    TenantScopeError,
  );
});

test('unscoped MessageQuota upsert still fails closed', () => {
  assert.throws(
    () =>
      assertTenantScope({
        model: 'MessageQuota',
        action: 'upsert',
        args: { where: { month: '2026-10' } },
      }),
    TenantScopeError,
  );
});

test('existing exemptions still hold (top-level businessId, SavedPro customerId)', () => {
  assert.doesNotThrow(() =>
    assertTenantScope({
      model: 'MessageQuota',
      action: 'findMany',
      args: { where: { businessId: 'biz_1' } },
    }),
  );
  assert.doesNotThrow(() =>
    assertTenantScope({
      model: 'SavedPro',
      action: 'findUnique',
      args: { where: { customerId_businessId: { customerId: 'cus_1', businessId: 'biz_1' } } },
    }),
  );
});
