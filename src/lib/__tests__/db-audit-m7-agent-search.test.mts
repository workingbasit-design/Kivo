/**
 * Tests for DB-audit m7: GET /api/agent/v1/search filters DB-side.
 *
 * - buildAgentSearchWhere() keeps the exact matchesServiceKeyword /
 *   matchesCity semantics (every service word in the business name or an
 *   ACTIVE service name; city substring of the address) as a Prisma where.
 * - The route passes that where + `take: limit` to findMany (no more
 *   `take: 200` + JS filter/slice) and the response reflects the filter:
 *   unverified / booking-disabled businesses never appear, inactive
 *   services never match or list, ratings/contact gating still apply.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/db-audit-m7-agent-search.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./agent-search-stub-loader.mjs', import.meta.url);

const { GET } = await import('@/app/api/agent/v1/search/route.ts');
const { buildAgentSearchWhere } = await import('@/lib/directory.ts');
const stub = await import('./agent-search-stub.mjs');

function req(url) {
  return new Request(url);
}

async function body(res) {
  return JSON.parse(await res.text());
}

function names(json) {
  return json.results.map((r) => r.name);
}

// --- buildAgentSearchWhere: pure builder -----------------------------------

test('m7 builder: empty filters keep only the eligibility gate', () => {
  assert.deepEqual(buildAgentSearchWhere('', ''), {
    directoryOptIn: true,
    directoryVerifiedAt: { not: null },
    bookingPage: { is: { enabled: true } },
  });
});

test('m7 builder: one service word matches name OR an active service', () => {
  const where = buildAgentSearchWhere('Drain', '');
  assert.equal(where.AND.length, 1);
  assert.deepEqual(where.AND[0], {
    OR: [
      { name: { contains: 'drain', mode: 'insensitive' } },
      {
        services: {
          some: { name: { contains: 'drain', mode: 'insensitive' }, active: true },
        },
      },
    ],
  });
});

test('m7 builder: multi-word service needs every word (AND of ORs)', () => {
  const where = buildAgentSearchWhere('Drain  Cleaning', '');
  assert.equal(where.AND.length, 2);
  assert.equal(where.AND[0].OR[0].name.contains, 'drain');
  assert.equal(where.AND[1].OR[0].name.contains, 'cleaning');
});

test('m7 builder: city is an address substring, case-insensitive', () => {
  const where = buildAgentSearchWhere('', 'TORONTO');
  assert.equal(where.AND.length, 1);
  assert.deepEqual(where.AND[0], {
    address: { contains: 'toronto', mode: 'insensitive' },
  });
});

test('m7 builder: service + city combine in one AND', () => {
  const where = buildAgentSearchWhere('panel upgrade', 'Montréal');
  assert.equal(where.AND.length, 3);
  assert.equal(where.AND[2].address.contains, 'montréal');
});

// --- Route: DB-side filtering, bounded take -------------------------------

test('m7 route: no params returns only eligible businesses, take = default 10', async () => {
  stub.resetAgentSearchStub();
  const res = await GET(req('https://app.test/api/agent/v1/search'));
  assert.equal(res.status, 200);
  const json = await body(res);
  assert.equal(json.protocol, 'everyjob-agent');
  assert.deepEqual(names(json), ['Harbour Clean Co', 'Maple Plumbing', 'Montreal Spark Electric']);
  const args = stub.calls.businessFindMany[0];
  assert.equal(args.take, 10);
  assert.deepEqual(args.where, buildAgentSearchWhere('', ''));
});

test('m7 route: service keyword matches a service name, not the business name', async () => {
  stub.resetAgentSearchStub();
  const res = await GET(req('https://app.test/api/agent/v1/search?service=drain'));
  assert.equal(res.status, 200);
  assert.deepEqual(names(await body(res)), ['Maple Plumbing']);
});

test('m7 route: service keyword matches the business name', async () => {
  stub.resetAgentSearchStub();
  const res = await GET(req('https://app.test/api/agent/v1/search?service=spark'));
  assert.equal(res.status, 200);
  assert.deepEqual(names(await body(res)), ['Montreal Spark Electric']);
});

test('m7 route: multi-word service needs every word', async () => {
  stub.resetAgentSearchStub();
  const res = await GET(req('https://app.test/api/agent/v1/search?service=drain%20cleaning'));
  assert.equal(res.status, 200);
  assert.deepEqual(names(await body(res)), ['Maple Plumbing']);
  const res2 = await GET(req('https://app.test/api/agent/v1/search?service=drain%20panel'));
  assert.equal(res2.status, 200);
  assert.deepEqual(names(await body(res2)), []);
});

test('m7 route: city filters on the address', async () => {
  stub.resetAgentSearchStub();
  const res = await GET(req('https://app.test/api/agent/v1/search?city=Toronto'));
  assert.equal(res.status, 200);
  assert.deepEqual(names(await body(res)), ['Harbour Clean Co', 'Maple Plumbing']);
  const res2 = await GET(req('https://app.test/api/agent/v1/search?city=Montr%C3%A9al'));
  assert.equal(res2.status, 200);
  assert.deepEqual(names(await body(res2)), ['Montreal Spark Electric']);
});

test('m7 route: limit bounds the read (take = limit) and the response', async () => {
  stub.resetAgentSearchStub();
  const res = await GET(req('https://app.test/api/agent/v1/search?limit=1'));
  assert.equal(res.status, 200);
  const json = await body(res);
  assert.equal(json.results.length, 1);
  assert.equal(stub.calls.businessFindMany[0].take, 1);
});

test('m7 route: inactive services never match and never list', async () => {
  stub.resetAgentSearchStub();
  const res = await GET(req('https://app.test/api/agent/v1/search?service=boiler'));
  assert.equal(res.status, 200);
  assert.deepEqual(names(await body(res)), []);
  const res2 = await GET(req('https://app.test/api/agent/v1/search?service=maple'));
  const maple = (await body(res2)).results[0];
  assert.deepEqual(
    maple.services.map((s) => s.name),
    ['Drain Cleaning', 'Furnace Tune-up']
  );
});

test('m7 route: ratings, contact gating and profile URLs still map', async () => {
  stub.resetAgentSearchStub();
  const res = await GET(req('https://app.test/api/agent/v1/search?service=maple'));
  const maple = (await body(res)).results[0];
  assert.equal(maple.rating, 4.5);
  assert.equal(maple.reviewCount, 2);
  assert.equal(maple.phone, '4165550102');
  assert.equal(maple.profileUrl, 'https://app.test/p/maple-plumbing');
  assert.equal(maple.services[0].priceCents, '14900');

  const res2 = await GET(req('https://app.test/api/agent/v1/search?service=spark'));
  const spark = (await body(res2)).results[0];
  assert.equal(spark.rating, 5);
  assert.equal(spark.reviewCount, 1);
  assert.equal(spark.phone, null);
  assert.equal(spark.whatsapp, null);
  // Hidden address -> locality only, not the full address.
  assert.equal(spark.locality, 'Montréal, QC');
});

test('m7 route: over-limit limit is rejected, no DB call', async () => {
  stub.resetAgentSearchStub();
  const res = await GET(req('https://app.test/api/agent/v1/search?limit=99'));
  assert.equal(res.status, 400);
  assert.equal(stub.calls.businessFindMany.length, 0);
});

test('m7 route: no take: 200 and no JS filter/slice left in the route', async () => {
  const { readFileSync } = await import('node:fs');
  const code = readFileSync(
    new URL('../../app/api/agent/v1/search/route.ts', import.meta.url),
    'utf8'
  );
  assert.ok(!/take: 200/.test(code), 'the unbounded take: 200 must be gone');
  assert.ok(!/\.filter\(/.test(code), 'JS filtering must be gone');
  assert.ok(!/\.slice\(0, limit\)/.test(code), 'JS slicing must be gone');
  assert.match(code, /take: limit/);
  assert.match(code, /where: buildAgentSearchWhere\(service, city\)/);
});
