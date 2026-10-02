/**
 * Tests for GET /api/copilot (guided-flow lookups: customers + services).
 *
 * - Auth required (401 without a session).
 * - Tenant-scoped: only the caller's business rows are returned.
 * - zod-validated query: unknown type / overlong q → 400.
 * - Rate-limited: 60 lookups/min per user (real in-memory limiter).
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/copilot-lookup.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./copilot-lookup-stub-loader.mjs', import.meta.url);

const { GET } = await import('@/app/api/copilot/route.ts');
const stub = await import('./copilot-lookup-stub.mjs');

function req(url) {
  return new Request(url);
}

async function body(res) {
  return JSON.parse(await res.text());
}

test('unauthenticated lookup → 401', async () => {
  stub.resetLookupStub();
  stub.setLookupSession(null);
  const res = await GET(req('https://app.test/api/copilot?type=customers'));
  assert.equal(res.status, 401);
});

test('invalid type → 400', async () => {
  stub.resetLookupStub();
  const res = await GET(req('https://app.test/api/copilot?type=widgets'));
  assert.equal(res.status, 400);
  assert.equal(stub.calls.customerFindMany.length, 0);
  assert.equal(stub.calls.serviceFindMany.length, 0);
});

test('customers: tenant-scoped, searchable, minimal fields', async () => {
  stub.resetLookupStub();
  const res = await GET(req('https://app.test/api/copilot?type=customers'));
  assert.equal(res.status, 200);
  const json = await body(res);
  assert.equal(json.customers.length, 2);
  assert.deepEqual(
    json.customers.map((c) => c.name).sort(),
    ['Jean Tremblay', 'Sarah Miller']
  );
  // No businessId leaks into the payload; only whitelisted fields.
  for (const c of json.customers) {
    assert.deepEqual(Object.keys(c).sort(), ['address', 'id', 'name', 'phone']);
  }
  // Prisma call was scoped by businessId.
  assert.equal(stub.calls.customerFindMany[0].where.businessId, 'biz_1');

  // Search narrows.
  const res2 = await GET(req('https://app.test/api/copilot?type=customers&q=sarah'));
  const json2 = await body(res2);
  assert.equal(json2.customers.length, 1);
  assert.equal(json2.customers[0].name, 'Sarah Miller');
});

test('services: tenant-scoped', async () => {
  stub.resetLookupStub();
  const res = await GET(req('https://app.test/api/copilot?type=services'));
  assert.equal(res.status, 200);
  const json = await body(res);
  assert.equal(json.services.length, 1);
  assert.equal(json.services[0].name, 'Furnace repair');
  assert.deepEqual(Object.keys(json.services[0]).sort(), ['id', 'name', 'price']);
  assert.equal(stub.calls.serviceFindMany[0].where.businessId, 'biz_1');
});

test('rate limit: 61st lookup within a minute → 429', async () => {
  stub.resetLookupStub();
  stub.setLookupSession({ user: { id: 'user_ratelimit', businessId: 'biz_1' } });
  let last;
  for (let i = 0; i < 61; i++) {
    last = await GET(req('https://app.test/api/copilot?type=services'));
  }
  assert.equal(last.status, 429);
});
