/**
 * P4-D-001…005 — Database & tenant isolation (REAL Postgres, REAL guard).
 *
 * Fail-closed: throws if TEST_DATABASE_URL is unset (CI must report 0 skipped).
 * Never runs against production — the URL is supplied by the caller (CI service).
 *
 * P4-D-001: Business B cannot select/insert/update/delete Business A's rows.
 * P4-D-002: technician membership integrity (behavioral role tests: P4-A/P4-E).
 * P4-D-003: anonymous reads — public tables unguarded, tenant tables guarded.
 * P4-D-004: consumers see only their own rows.
 * P4-D-005: storage rows (Attachment) tenant-scoped.
 * P4-D-006: RLS policy gate — see rls.test.mts (8/8, not duplicated here).
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { assertTenantScope, TENANT_MODELS, TenantScopeError } from '../tenant-guard.ts';

const TEST_URL = process.env.TEST_DATABASE_URL;
if (!TEST_URL) {
  throw new Error(
    'P4-D: TEST_DATABASE_URL is required. These tests fail closed (no silent skips).'
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

const A = 'p4d-biz-a';
const B = 'p4d-biz-b';

describe('P4-D: database tenant isolation', () => {
  let db: PrismaClient;

  before(async () => {
    db = guardedClient();
    await db.business.createMany({
      data: [
        { id: A, name: 'P4D Biz A', timezone: 'America/Toronto' },
        { id: B, name: 'P4D Biz B', timezone: 'America/Toronto' },
      ],
      skipDuplicates: true,
    });
  });

  after(async () => {
    // Reverse-FK cleanup.
    for (const biz of [A, B]) {
      await db.attachment.deleteMany({ where: { businessId: biz } });
      await db.lead.deleteMany({ where: { businessId: biz } });
      await db.equipment.deleteMany({ where: { businessId: biz } });
      await db.service.deleteMany({ where: { businessId: biz } });
      await db.invoice.deleteMany({ where: { businessId: biz } });
      await db.quote.deleteMany({ where: { businessId: biz } });
      await db.job.deleteMany({ where: { businessId: biz } });
      await db.membership.deleteMany({ where: { businessId: biz } });
      await db.customer.deleteMany({ where: { businessId: biz } });
    }
    await db.user.deleteMany({ where: { id: { in: ['p4d-user-a', 'p4d-user-b', 'p4d-tech-a'] } } });
    await db.customerUser.deleteMany({
      where: { id: { in: ['p4d-consumer-1', 'p4d-consumer-2'] } },
    });
    await db.business.deleteMany({ where: { id: { in: [A, B] } } });
    await db.$disconnect();
  });

  it('P4-D-001: guard sweep — every TENANT_MODELS model rejects unscoped reads', async () => {
    for (const model of TENANT_MODELS) {
      const delegate = (db as unknown as Record<string, { findMany: (a: unknown) => Promise<unknown[]> }>)[model[0].toLowerCase() + model.slice(1)];
      if (!delegate) continue;
      await assert.rejects(delegate.findMany({ where: {} }), TenantScopeError, model);
    }
  });

  it('P4-D-001: B cannot SELECT/UPDATE/DELETE A rows (core models)', async () => {
    const custA = await db.customer.create({ data: { id: 'p4d-cust-a', name: 'A Customer', businessId: A } });
    const custB = await db.customer.create({ data: { id: 'p4d-cust-b', name: 'B Customer', businessId: B } });
    const jobA = await db.job.create({
      data: {
        id: 'p4d-job-a', title: 'A Job', businessId: A, customerId: custA.id,
        date: new Date(), priceCents: BigInt(10000), status: 'SCHEDULED',
      },
    });

    // SELECT as B: only B rows.
    const seen = await db.customer.findMany({ where: { businessId: B } });
    assert.ok(seen.every((c) => c.businessId === B));
    assert.ok(!seen.some((c) => c.id === custA.id));
    // Direct by-id lookup of A's row with B's scope -> null (the app pattern).
    assert.equal(await db.customer.findUnique({ where: { id: custA.id, businessId: B } }), null);
    assert.equal(
      (await db.customer.findUnique({ where: { id: custB.id, businessId: B } } ))?.id,
      custB.id,
    );

    // UPDATE A's row with B's scope -> P2025 (not found).
    await assert.rejects(
      db.customer.update({ where: { id: custA.id, businessId: B }, data: { name: 'Hacked' } }),
      (e: unknown) => (e as { code?: string }).code === 'P2025',
    );
    // DELETE A's row with B's scope -> P2025.
    await assert.rejects(
      db.job.delete({ where: { id: jobA.id, businessId: B } }),
      (e: unknown) => (e as { code?: string }).code === 'P2025',
    );
    // A's data untouched.
    assert.equal((await db.customer.findUnique({ where: { id: custA.id, businessId: A } } ))?.name, 'A Customer');

    // INSERT always carries businessId (NOT NULL) — a B-scoped create lands in B.
    const svcB = await db.service.create({
      data: { id: 'p4d-svc-b', name: 'B Service', priceCents: BigInt(5000), businessId: B },
    });
    assert.equal(svcB.businessId, B);
  });

  it('P4-D-001: invoices, quotes, attachments scoped (money + storage rows)', async () => {
    const custA = await db.customer.findUnique({ where: { id: 'p4d-cust-a', businessId: A } });
    assert.ok(custA);
    const invA = await db.invoice.create({
      data: {
        id: 'p4d-inv-a', number: 'INV-P4D-A', businessId: A, customerId: custA.id,
        date: new Date(), subtotalCents: BigInt(10000), taxAmountCents: BigInt(1300),
        totalCents: BigInt(11300), status: 'UNPAID',
      },
    });
    const attA = await db.attachment.create({
      data: {
        id: 'p4d-att-a', businessId: A, entityType: 'JOB', entityId: 'p4d-job-a',
        fileName: 'receipt.png', mimeType: 'image/png', sizeBytes: 123,
        blobUrl: 'https://blob.test/a', blobPathname: 'a/receipt.png',
      },
    });
    // P4-D-005: B cannot resolve A's attachment row (HTTP layer must 404 — P4-X).
    assert.equal(await db.attachment.findUnique({ where: { id: attA.id, businessId: B } }), null);
    assert.equal(await db.invoice.findUnique({ where: { id: invA.id, businessId: B } }), null);
    await assert.rejects(
      db.invoice.update({ where: { id: invA.id, businessId: B }, data: { status: 'PAID' } }),
      (e: unknown) => (e as { code?: string }).code === 'P2025',
    );
  });

  it('P4-D-002: technician membership is confined to their business', async () => {
    await db.user.createMany({
      data: [
        { id: 'p4d-user-a', email: 'p4d-a@test.ca', passwordHash: 'x' },
        { id: 'p4d-tech-a', email: 'p4d-tech@test.ca', passwordHash: 'x' },
      ],
      skipDuplicates: true,
    });
    await db.membership.createMany({
      data: [
        { id: 'p4d-mem-a', userId: 'p4d-user-a', businessId: A, role: 'OWNER', status: 'ACTIVE' },
        { id: 'p4d-mem-tech', userId: 'p4d-tech-a', businessId: A, role: 'TECHNICIAN', status: 'ACTIVE' },
      ],
      skipDuplicates: true,
    });
    // The technician has NO membership in B — role checks resolve through this
    // (app pattern: findFirst with top-level businessId, cf. src/lib/membership.ts).
    assert.equal(
      await db.membership.findFirst({ where: { userId: 'p4d-tech-a', businessId: B } }),
      null,
    );
    assert.equal(
      (await db.membership.findFirst({ where: { userId: 'p4d-tech-a', businessId: A } }))?.role,
      'TECHNICIAN',
    );
  });

  it('P4-D-003: anonymous — public tables readable, tenant tables guarded', async () => {
    // Business (directory root) is intentionally NOT in TENANT_MODELS.
    assert.ok(!TENANT_MODELS.has('Business'));
    const biz = await db.business.findUnique({ where: { id: A } });
    assert.equal(biz?.id, A);
    // But any tenant table without scope still throws.
    await assert.rejects(db.customer.findMany({ where: {} }), TenantScopeError);
  });

  it('P4-D-004: consumers see only their own rows', async () => {
    await db.customerUser.createMany({
      data: [
        { id: 'p4d-consumer-1', email: 'p4d-c1@test.ca', passwordHash: 'x' },
        { id: 'p4d-consumer-2', email: 'p4d-c2@test.ca', passwordHash: 'x' },
      ],
      skipDuplicates: true,
    });
    await db.savedPro.createMany({
      data: [
        { id: 'p4d-sp-1', customerId: 'p4d-consumer-1', businessId: A },
        { id: 'p4d-sp-2', customerId: 'p4d-consumer-2', businessId: A },
      ],
      skipDuplicates: true,
    });
    const mine = await db.savedPro.findMany({
      where: { customerId: 'p4d-consumer-1', businessId: A },
    });
    assert.deepEqual(mine.map((r) => r.id), ['p4d-sp-1']);
  });
});
