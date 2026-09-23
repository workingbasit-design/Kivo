/**
 * Notification sync tests (Track 3): run the REAL syncNotifications() against
 * an in-memory prisma stub with fixtures from TWO businesses. Asserts:
 *  - candidates are generated from real records only (nothing seeded/faked)
 *  - strict tenant isolation (the other business's records never notify)
 *  - disabled types are not generated and their pending items are cleared
 *  - every query is scoped by businessId
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./notifications-stub-loader.mjs', import.meta.url);

const { syncNotifications } = await import('../notifications.ts');
const stub = await import('./notifications-stub.mjs');

function bizCalls(name: string) {
  return stub.calls.filter((c) => c[0] === name);
}

test('sync generates candidates only from the business\u2019s own records', async () => {
  stub.resetNotificationStub();
  const count = await syncNotifications('biz-test');
  assert.ok(count > 0, 'expected some notifications');

  const keys = stub.created.map((c) => c.dedupeKey);
  // Real records -> notifications
  assert.ok(keys.some((k) => k.startsWith('job_tomorrow:jt1')), `missing job_tomorrow: ${keys}`);
  assert.ok(keys.some((k) => k.startsWith('booking_new:jn1')), `missing booking_new: ${keys}`);
  assert.ok(keys.some((k) => k.startsWith('invoice_overdue:i1')), `missing invoice_overdue: ${keys}`);
  assert.ok(keys.some((k) => k.startsWith('quote_expiring:q1')), `missing quote_expiring: ${keys}`);
  assert.ok(keys.some((k) => k.startsWith('payment_recorded:p1')), `missing payment_recorded: ${keys}`);
  // Other tenant's records -> never
  assert.ok(!keys.some((k) => k.includes('jtX')), 'leaked other-tenant job');
  assert.ok(!keys.some((k) => k.includes('iX')), 'leaked other-tenant invoice');
  // Every stored row carries the right tenant
  for (const c of stub.created) {
    assert.equal(c.businessId, 'biz-test');
    assert.ok(c.dedupeKey.length > 5);
  }
});

test('sync scopes every query by businessId', async () => {
  stub.resetNotificationStub();
  await syncNotifications('biz-test');
  for (const [name, where] of stub.calls) {
    if (name === 'business.findUnique') {
      assert.equal(where.id, 'biz-test');
    } else if (name.endsWith('.findMany') || name === 'notification.deleteMany') {
      const scoped =
        where?.businessId === 'biz-test' || where?.invoice?.businessId === 'biz-test';
      assert.ok(scoped, `${name} not tenant-scoped: ${JSON.stringify(where)}`);
    } else if (name === 'notification.createMany') {
      for (const row of stub.created) assert.equal(row.businessId, 'biz-test');
    }
  }
  assert.ok(bizCalls('job.findMany').length >= 1, 'expected job queries');
});

test('sync with a disabled type neither generates nor keeps pending items', async () => {
  stub.resetNotificationStub();
  // Flip invoice_overdue off for biz-test via the stub fixture.
  const stubAny = stub as unknown as { __flipSettings?: (s: string) => void };
  void stubAny;
  const { prisma } = stub;
  const orig = prisma.business.findUnique;
  prisma.business.findUnique = async ({ where }: { where: { id: string } }) => {
    const b = await orig({ where });
    return b ? { ...b, notificationSettings: '{"invoice_overdue": false}' } : b;
  };
  try {
    await syncNotifications('biz-test');
  } finally {
    prisma.business.findUnique = orig;
  }
  const keys = stub.created.map((c: { dedupeKey: string }) => c.dedupeKey);
  assert.ok(!keys.some((k) => k.startsWith('invoice_overdue:')), 'disabled type was generated');
  const deletes = bizCalls('notification.deleteMany');
  assert.ok(
    deletes.some(([, where]) => (where.type?.in ?? []).includes('invoice_overdue')),
    'disabled type pending items were not cleared'
  );
});

test('sync for an unknown business does nothing', async () => {
  stub.resetNotificationStub();
  const count = await syncNotifications('biz-nope');
  assert.equal(count, 0);
  assert.equal(stub.created.length, 0);
});
