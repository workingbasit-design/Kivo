/**
 * Concierge send-action hardening tests (stubbed prisma, real action code).
 *
 * Proves: exact replay identity, transactional all-or-nothing, send-time
 * eligibility re-check, rate limiting, selection bounds, and that the
 * persisted message equals the previewed message.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./concierge-stub-loader.mjs', import.meta.url);

const stubUrl = new URL('./concierge-stub.mjs', import.meta.url).href;
const stub = await import(stubUrl);
const { sendConciergeRequests } = await import('@/app/actions/concierge.ts');
const { buildConciergeMessage } = await import('@/lib/concierge.ts');

const BIZ_A = { id: 'biz-a', name: 'Pro A', directoryOptIn: true, directoryVerifiedAt: new Date() };
const BIZ_B = { id: 'biz-b', name: 'Pro B', directoryOptIn: true, directoryVerifiedAt: new Date() };
const BIZ_C = { id: 'biz-c', name: 'Pro C', directoryOptIn: true, directoryVerifiedAt: new Date() };
const BIZ_D = { id: 'biz-d', name: 'Pro D', directoryOptIn: true, directoryVerifiedAt: new Date() };
const BIZ_UNVERIFIED = { id: 'biz-u', name: 'Pro U', directoryOptIn: true, directoryVerifiedAt: null };

function input(over = {}) {
  return {
    idempotencyKey: `key-${Math.random().toString(36).slice(2)}`,
    businessIds: ['biz-a', 'biz-b'],
    serviceLabel: 'Plumbing',
    description: 'Kitchen sink leaking',
    name: 'Jane Doe',
    phone: '5145551234',
    city: 'Montreal',
    ...over,
  };
}

function asCustomer(id) {
  stub.__setConciergeSession({ id, email: `${id}@example.com`, locale: 'en' });
}

test('replay returns the EXACT original request ids, not older requests', async () => {
  stub.__resetConciergeStub();
  stub.__seedConciergeStub([BIZ_A, BIZ_B]);
  asCustomer('replay-cust');
  const db = stub.__conciergeDb();

  // Simulate an OLDER request to the same businesses (previous send).
  db.quoteRequests.push({ id: 'qr-OLD-A', customerId: 'replay-cust', businessId: 'biz-a' });
  db.quoteRequests.push({ id: 'qr-OLD-B', customerId: 'replay-cust', businessId: 'biz-b' });

  const first = await sendConciergeRequests(input({ idempotencyKey: 'replay-key-1' }));
  assert.equal(first.ok, true);
  assert.equal(first.requestIds.length, 2);
  assert.ok(!first.requestIds.includes('qr-OLD-A'), 'must not include older requests');

  const replay = await sendConciergeRequests(input({ idempotencyKey: 'replay-key-1' }));
  assert.equal(replay.ok, true);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.requestIds, first.requestIds, 'replay returns exact original ids');
});

test('mid-send failure rolls back everything (no partial requests)', async () => {
  stub.__resetConciergeStub();
  stub.__seedConciergeStub([BIZ_A, BIZ_B]);
  asCustomer('rollback-cust');
  const db = stub.__conciergeDb();

  stub.__failNext('lead.create');
  const res = await sendConciergeRequests(input({ idempotencyKey: 'rollback-key-1' }));
  assert.equal(res.ok, false, 'send reports failure');
  assert.equal(db.quoteRequests.length, 0, 'no quote requests persisted');
  assert.equal(db.leads.length, 0, 'no leads persisted');
  assert.equal(db.conciergeSends.size, 0, 'no conciergeSend persisted');

  // A retry with a fresh key succeeds after the transient failure.
  const retry = await sendConciergeRequests(input({ idempotencyKey: 'rollback-key-2' }));
  assert.equal(retry.ok, true);
  assert.equal(db.quoteRequests.length, 2);
});

test('unverified pro is rejected at send time', async () => {
  stub.__resetConciergeStub();
  stub.__seedConciergeStub([BIZ_A, BIZ_UNVERIFIED]);
  asCustomer('elig-cust');

  const res = await sendConciergeRequests(
    input({ businessIds: ['biz-a', 'biz-u'] })
  );
  assert.equal(res.ok, false);
  assert.match(res.error, /no longer available/i);
  assert.equal(stub.__conciergeDb().quoteRequests.length, 0, 'nothing created');
});

test('empty selection and over-limit selection are bounded', async () => {
  stub.__resetConciergeStub();
  stub.__seedConciergeStub([BIZ_A, BIZ_B, BIZ_C, BIZ_D]);
  asCustomer('bounds-cust');

  const empty = await sendConciergeRequests(input({ businessIds: [] }));
  assert.equal(empty.ok, false);

  const over = await sendConciergeRequests(
    input({ businessIds: ['biz-a', 'biz-b', 'biz-c', 'biz-d', 'biz-a'] })
  );
  assert.equal(over.ok, true);
  assert.equal(over.requestIds.length, 3, 'capped at 3 pros, deduped');
});

test('rate limit blocks excessive sends', async () => {
  stub.__resetConciergeStub();
  stub.__seedConciergeStub([BIZ_A]);
  asCustomer('ratelimit-cust');

  for (let i = 0; i < 5; i++) {
    const r = await sendConciergeRequests(input({ businessIds: ['biz-a'] }));
    assert.equal(r.ok, true, `send ${i + 1} should pass`);
  }
  const blocked = await sendConciergeRequests(input({ businessIds: ['biz-a'] }));
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /recently|wait/i);
});

test('persisted message equals the previewed message', async () => {
  stub.__resetConciergeStub();
  stub.__seedConciergeStub([BIZ_A]);
  asCustomer('msg-cust');
  const db = stub.__conciergeDb();

  const inp = input({ businessIds: ['biz-a'] });
  const res = await sendConciergeRequests(inp);
  assert.equal(res.ok, true);

  const expected = buildConciergeMessage({
    serviceLabel: inp.serviceLabel,
    description: inp.description.trim(),
    name: inp.name.trim(),
    phone: inp.phone.trim(),
    city: inp.city.trim(),
    locale: 'en',
  });
  const qr = db.quoteRequests.find((r) => r.id === res.requestIds[0]);
  assert.equal(qr._messages[0].body, expected, 'quote message matches preview');
  assert.equal(qr.description, inp.description.trim());
  const leadRec = db.leads.find((l) => l.businessId === 'biz-a');
  assert.equal(leadRec.details, expected, 'lead details match preview');
});
