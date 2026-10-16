/**
 * F6-003 — Price Book cross-business isolation (REAL Postgres, REAL guard).
 *
 * Fail-closed: throws if TEST_DATABASE_URL is unset (CI must report 0 skipped).
 * Never runs against production — the URL is supplied by the caller (CI service).
 *
 * - Business B cannot list/select/update Business A's services.
 * - Unscoped Service reads are rejected by the tenant guard.
 * - F6 defaults apply (kind SERVICE, taxCategory TAXABLE_GST_HST, active true).
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { assertTenantScope, TenantScopeError } from '../tenant-guard.ts';

const TEST_URL = process.env.TEST_DATABASE_URL;
if (!TEST_URL) {
  throw new Error(
    'F6-003: TEST_DATABASE_URL is required. These tests fail closed (no silent skips).'
  );
}

/** Prisma client with the REAL tenant-guard middleware (same as lib/prisma.ts). */
function guardedClient(): PrismaClient {
  const prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
  prisma.$use(async (params, next) => {
    assertTenantScope(params);
    return next(params);
  });
  return prisma;
}

const A = 'f6-biz-a';
const B = 'f6-biz-b';

describe('F6-003: price book cross-business isolation', () => {
  let db: PrismaClient;

  before(async () => {
    db = guardedClient();
    await db.business.createMany({
      data: [
        { id: A, name: 'F6 Biz A', timezone: 'America/Toronto' },
        { id: B, name: 'F6 Biz B', timezone: 'America/Toronto' },
      ],
      skipDuplicates: true,
    });
    await db.service.create({
      data: {
        id: 'f6-svc-a1',
        name: 'F6 Secret Service A',
        priceCents: BigInt(14900),
        costCents: BigInt(5600),
        businessId: A,
      },
    });
  });

  after(async () => {
    await db.service.deleteMany({ where: { businessId: A } });
    await db.service.deleteMany({ where: { businessId: B } });
    await db.business.deleteMany({ where: { id: { in: [A, B] } } });
    await db.$disconnect();
  });

  it('unscoped Service read is rejected (TenantScopeError)', async () => {
    await assert.rejects(db.service.findMany({ where: {} }), TenantScopeError);
  });

  it("Business B cannot see Business A's service", async () => {
    const rows = await db.service.findMany({ where: { businessId: B } });
    assert.ok(
      rows.every((r) => r.businessId === B),
      'B must only ever see its own rows'
    );
    assert.ok(!rows.some((r) => r.id === 'f6-svc-a1'), "A's service leaked to B");
  });

  it("Business B cannot update Business A's service", async () => {
    const hit = await db.service.findFirst({ where: { id: 'f6-svc-a1', businessId: B } });
    assert.equal(hit, null);
    // And an update scoped to B touches nothing.
    const res = await db.service.updateMany({
      where: { id: 'f6-svc-a1', businessId: B },
      data: { priceCents: BigInt(1) },
    });
    assert.equal(res.count, 0);
    const untouched = await db.service.findFirst({ where: { id: 'f6-svc-a1', businessId: A } });
    assert.equal(untouched?.priceCents, BigInt(14900));
  });

  it('F6 column defaults apply on create', async () => {
    const row = await db.service.findFirst({ where: { id: 'f6-svc-a1', businessId: A } });
    assert.ok(row);
    assert.equal(row.kind, 'SERVICE');
    assert.equal(row.taxCategory, 'TAXABLE_GST_HST');
    assert.equal(row.unit, 'each');
    assert.equal(row.active, true);
    assert.equal(row.costCents, BigInt(5600));
  });

  it('archived items are excluded from the active quick-add scope', async () => {
    await db.service.update({
      where: { id: 'f6-svc-a1', businessId: A },
      data: { active: false },
    });
    const active = await db.service.findMany({ where: { businessId: A, active: true } });
    assert.ok(!active.some((r) => r.id === 'f6-svc-a1'));
    // Restore for other tests / cleanup.
    await db.service.update({
      where: { id: 'f6-svc-a1', businessId: A },
      data: { active: true },
    });
  });
});
