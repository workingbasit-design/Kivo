/**
 * Tests for GET /api/search (command-palette record lookup).
 *
 * - Auth required (401 without a session).
 * - Tenant-scoped: only the caller's business rows are returned, across
 *   all four kinds (customers, jobs, quotes, invoices).
 * - zod-validated query: missing q / overlong q → 400, no DB calls.
 * - Rate-limited: 60 searches/min per user (real in-memory limiter).
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/search.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./search-stub-loader.mjs', import.meta.url);

const { GET } = await import('@/app/api/search/route.ts');
const stub = await import('./search-stub.mjs');

function req(url) {
  return new Request(url);
}

async function body(res) {
  return JSON.parse(await res.text());
}

test('unauthenticated search → 401', async () => {
  stub.resetSearchStub();
  stub.setSearchSession(null);
  const res = await GET(req('https://app.test/api/search?q=sarah'));
  assert.equal(res.status, 401);
});

test('missing q → 400, no DB calls', async () => {
  stub.resetSearchStub();
  const res = await GET(req('https://app.test/api/search'));
  assert.equal(res.status, 400);
  assert.equal(stub.calls.customerFindMany.length, 0);
  assert.equal(stub.calls.jobFindMany.length, 0);
  assert.equal(stub.calls.quoteFindMany.length, 0);
  assert.equal(stub.calls.invoiceFindMany.length, 0);
});

test('overlong q → 400', async () => {
  stub.resetSearchStub();
  const res = await GET(req(`https://app.test/api/search?q=${'x'.repeat(81)}`));
  assert.equal(res.status, 400);
});

test('search "sarah": tenant-scoped matches across all four kinds', async () => {
  stub.resetSearchStub();
  const res = await GET(req('https://app.test/api/search?q=sarah'));
  assert.equal(res.status, 200);
  const json = await body(res);
  // Only biz_1 rows; the other-business rows never leak.
  assert.deepEqual(
    json.customers.map((c) => c.name),
    ['Sarah Miller']
  );
  assert.deepEqual(
    json.jobs.map((j) => j.title),
    ['Furnace tune-up']
  );
  assert.deepEqual(
    json.quotes.map((q) => q.number),
    ['Q-1001']
  );
  assert.deepEqual(
    json.invoices.map((i) => i.number),
    ['INV-2001']
  );
  // Minimal fields only; no businessId leaks.
  assert.deepEqual(Object.keys(json.customers[0]).sort(), ['id', 'name', 'phone']);
  assert.deepEqual(Object.keys(json.jobs[0]).sort(), ['customerName', 'id', 'title']);
  assert.deepEqual(Object.keys(json.quotes[0]).sort(), ['customerName', 'id', 'number', 'title']);
  assert.deepEqual(Object.keys(json.invoices[0]).sort(), ['customerName', 'id', 'number', 'total']);
  // Invoice total is dollars, not cents.
  assert.equal(json.invoices[0].total, 135.6);
  // Every Prisma call was scoped by businessId.
  for (const log of Object.values(stub.calls)) {
    assert.equal(log[0].where.businessId, 'biz_1');
  }
});

test('search by invoice number narrows to that invoice', async () => {
  stub.resetSearchStub();
  const res = await GET(req('https://app.test/api/search?q=INV-2002'));
  const json = await body(res);
  assert.equal(json.invoices.length, 1);
  assert.equal(json.invoices[0].number, 'INV-2002');
  assert.equal(json.customers.length, 0);
  assert.equal(json.jobs.length, 0);
  assert.equal(json.quotes.length, 0);
});

test('search with no match returns four empty lists', async () => {
  stub.resetSearchStub();
  const res = await GET(req('https://app.test/api/search?q=zzzznope'));
  const json = await body(res);
  assert.deepEqual(json, { customers: [], jobs: [], quotes: [], invoices: [] });
});

test('rate limit: 61st search within a minute → 429', async () => {
  stub.resetSearchStub();
  stub.setSearchSession({ user: { id: 'user_search_ratelimit', businessId: 'biz_1' } });
  let last;
  for (let i = 0; i < 61; i++) {
    last = await GET(req('https://app.test/api/search?q=sarah'));
  }
  assert.equal(last.status, 429);
});
