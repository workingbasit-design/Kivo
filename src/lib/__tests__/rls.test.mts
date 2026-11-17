/**
 * M11 RLS verification (DB-backed) — the plan's staging gate.
 *
 * The M11 migration creates tenant-isolation RLS policies on every business
 * table but does NOT force them (staged activation — see
 * docs/SECURITY_REPORT.md). This test proves the policies are CORRECT, so
 * that a future activation (FORCE + per-request set_config) is safe:
 *
 *  1. Staging gate (Job, Invoice, Customer — the plan's 3 gate tables):
 *     as a NON-OWNER role with app.business_id set, same-tenant reads/writes
 *     succeed, cross-tenant reads return nothing, cross-tenant writes fail,
 *     and an unset setting sees nothing (fail-closed).
 *  2. Parent-linked tables: InvoiceLineItem is isolated via Invoice.
 *  3. Rollout coverage: every business table has its {Table}_tenant_isolation
 *     policy (fails if a new business table is added without one).
 *
 * Needs a real Postgres with the M11 migration applied. Skips unless
 * TEST_DATABASE_URL is set. Creates a scratch `rls_tester` role (dropped
 * afterwards). Never runs against production.
 *
 * Run: TEST_DATABASE_URL=... node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/rls.test.mts
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient, Prisma } from '@prisma/client';

const TEST_URL = process.env.TEST_DATABASE_URL;
const TESTER_ROLE = 'rls_tester';
// The scratch role needs a known password: CI postgres (postgres:18 service)
// uses password auth, not trust, so an empty password is rejected.
// Alphanumeric only — embedded raw in SQL and a connection URL.
const TESTER_PASSWORD = 'rlsTesterPw123';

function testerUrl(): string {
  const u = new URL(TEST_URL!);
  u.username = TESTER_ROLE;
  u.password = TESTER_PASSWORD;
  return u.toString();
}

describe('M11 RLS staging gate', () => {
  if (!TEST_URL) {
    it('skipped - TEST_DATABASE_URL not set', () => {});
    return;
  }

  const owner = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
  const tester = new PrismaClient({ datasources: { db: { url: testerUrl() } } });

  let bizA = '';
  let bizB = '';

  /** Run fn inside one transaction with app.business_id set (or unset). */
  async function asTenant<T>(businessId: string | null, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return tester.$transaction(async (tx: Prisma.TransactionClient) => {
      if (businessId) {
        await tx.$executeRawUnsafe(`SET LOCAL app.business_id = '${businessId}'`);
      }
      return fn(tx);
    });
  }

  async function setup() {
    // Idempotent role + grants. ALTER ROLE always runs (not just on create)
    // so a role left behind by an earlier run still gets the known password.
    await owner.$executeRawUnsafe(
      `DO $$ BEGIN CREATE ROLE "${TESTER_ROLE}" WITH LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$`
    );
    await owner.$executeRawUnsafe(
      `ALTER ROLE "${TESTER_ROLE}" WITH LOGIN PASSWORD '${TESTER_PASSWORD}'`
    );
    await owner.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${TESTER_ROLE}"`);
    for (const t of ['Job', 'Invoice', 'Customer', 'InvoiceLineItem', 'Subcontractor', 'MonitorAlert']) {
      await owner.$executeRawUnsafe(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON "${t}" TO "${TESTER_ROLE}"`
      );
    }

    const a = await owner.business.create({ data: { name: 'rls-a', timezone: 'America/Toronto' } });
    const b = await owner.business.create({ data: { name: 'rls-b', timezone: 'America/Toronto' } });
    bizA = a.id;
    bizB = b.id;
    for (const [bizId, tag] of [[bizA, 'A'], [bizB, 'B']] as const) {
      const cust = await owner.customer.create({
        data: { name: `RLS Cust ${tag}`, businessId: bizId },
      });
      const job = await owner.job.create({
        data: {
          title: `RLS Job ${tag}`,
          businessId: bizId,
          status: 'SCHEDULED',
          customerId: cust.id,
          date: new Date(),
          priceCents: BigInt(0),
        },
      });
      const inv = await owner.invoice.create({
        data: {
          businessId: bizId,
          customerId: cust.id,
          number: `RLS-${tag}-1`,
          date: new Date(),
          subtotalCents: BigInt(10000),
          taxAmountCents: BigInt(0),
          totalCents: BigInt(10000),
          status: 'UNPAID',
        },
      });
      await owner.invoiceLineItem.create({
        data: {
          invoiceId: inv.id,
          description: `RLS line ${tag}`,
          qty: 1,
          unitPriceCents: BigInt(10000),
          position: 0,
        },
      });
      void job;
    }
  }

  async function teardown() {
    for (const bizId of [bizA, bizB]) {
      if (!bizId) continue;
      await owner.invoiceLineItem.deleteMany({
        where: { invoice: { businessId: bizId } },
      });
      await owner.invoice.deleteMany({ where: { businessId: bizId } });
      await owner.job.deleteMany({ where: { businessId: bizId } });
      await owner.customer.deleteMany({ where: { businessId: bizId } });
      await owner.business.delete({ where: { id: bizId } }).catch(() => {});
    }
    // Reassign to the connecting owner role from TEST_DATABASE_URL — never a
    // hardcoded 'postgres', which does not exist on CI (POSTGRES_USER=test).
    const ownerRole = new URL(TEST_URL!).username;
    await owner.$executeRawUnsafe(`REASSIGN OWNED BY "${TESTER_ROLE}" TO "${ownerRole}"`);
    await owner.$executeRawUnsafe(`DROP OWNED BY "${TESTER_ROLE}"`);
    await owner.$executeRawUnsafe(`DROP ROLE IF EXISTS "${TESTER_ROLE}"`);
    await tester.$disconnect();
    await owner.$disconnect();
  }

  after(teardown);

  it('gate tables: same-tenant reads see only own rows', async () => {
    await setup();
    const jobs = await asTenant(bizA, (tx) =>
      tx.$queryRawUnsafe<Array<{ title: string }>>(`SELECT "title" FROM "Job" ORDER BY "title"`)
    );
    assert.deepEqual(jobs.map((r) => r.title), ['RLS Job A']);

    const invoices = await asTenant(bizA, (tx) =>
      tx.$queryRawUnsafe<Array<{ number: string }>>(`SELECT "number" FROM "Invoice"`)
    );
    assert.deepEqual(invoices.map((r) => r.number), ['RLS-A-1']);

    const customers = await asTenant(bizB, (tx) =>
      tx.$queryRawUnsafe<Array<{ name: string }>>(`SELECT "name" FROM "Customer"`)
    );
    assert.deepEqual(customers.map((r) => r.name), ['RLS Cust B']);
  });

  it('gate tables: cross-tenant reads return nothing (fail-closed)', async () => {
    // Tenant A asks for tenant B's job explicitly — policy hides it.
    const rows = await asTenant(bizA, (tx) =>
      tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "Job" WHERE "title" = 'RLS Job B'`)
    );
    assert.equal(rows.length, 0);
  });

  it('gate tables: unset setting sees nothing', async () => {
    const rows = await asTenant(null, (tx) =>
      tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "Job"`)
    );
    assert.equal(rows.length, 0);
  });

  it('gate tables: cross-tenant INSERT is rejected (WITH CHECK)', async () => {
    const custA = await asTenant(bizA, (tx) =>
      tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "Customer" LIMIT 1`)
    );
    const custId = custA[0].id;
    await assert.rejects(
      asTenant(bizA, (tx) =>
        tx.$queryRawUnsafe(
          `INSERT INTO "Job" ("id","businessId","customerId","title","status","date","priceCents","createdAt","updatedAt") ` +
            `VALUES ('rls-x1','${bizB}','${custId}','evil job','SCHEDULED',NOW(),0,NOW(),NOW())`
        )
      ),
      /row-level security|policy/i
    );
  });

  it('gate tables: cross-tenant UPDATE affects zero rows', async () => {
    const n = await asTenant(bizA, (tx) =>
      tx.$executeRawUnsafe(`UPDATE "Job" SET "title" = 'pwned' WHERE "title" = 'RLS Job B'`)
    );
    assert.equal(n, 0);
    // And the row is untouched.
    const check = await asTenant(bizB, (tx) =>
      tx.$queryRawUnsafe<Array<{ title: string }>>(`SELECT "title" FROM "Job" WHERE "title" = 'RLS Job B'`)
    );
    assert.equal(check.length, 1);
  });

  it('gate tables: same-tenant INSERT and UPDATE work', async () => {
    const id = `rls-own-${Date.now()}`;
    const custA = await asTenant(bizA, (tx) =>
      tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "Customer" LIMIT 1`)
    );
    const custId = custA[0].id;
    await asTenant(bizA, (tx) =>
      tx.$queryRawUnsafe(
        `INSERT INTO "Job" ("id","businessId","customerId","title","status","date","priceCents","createdAt","updatedAt") ` +
          `VALUES ('${id}','${bizA}','${custId}','own job','SCHEDULED',NOW(),0,NOW(),NOW())`
      )
    );
    const n = await asTenant(bizA, (tx) =>
      tx.$executeRawUnsafe(`UPDATE "Job" SET "title" = 'own job 2' WHERE "id" = '${id}'`)
    );
    assert.equal(n, 1);
    await asTenant(bizA, (tx) =>
      tx.$queryRawUnsafe(`DELETE FROM "Job" WHERE "id" = '${id}'`)
    );
  });

  it('parent-linked tables: InvoiceLineItem isolated via Invoice', async () => {
    const rowsA = await asTenant(bizA, (tx) =>
      tx.$queryRawUnsafe<Array<{ description: string }>>(`SELECT "description" FROM "InvoiceLineItem"`)
    );
    assert.deepEqual(rowsA.map((r) => r.description), ['RLS line A']);
    // Cross-tenant insert through the line item is rejected because the
    // parent invoice belongs to tenant B.
    const parentB = await asTenant(bizB, (tx) =>
      tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "Invoice" LIMIT 1`)
    );
    await assert.rejects(
      asTenant(bizA, (tx) =>
        tx.$queryRawUnsafe(
          `INSERT INTO "InvoiceLineItem" ("id","invoiceId","description","qty","unitPriceCents","position") ` +
            `VALUES ('rls-li-x','${parentB[0].id}','evil line',1,100,0)`
        )
      ),
      /row-level security|policy/i
    );
  });

  it('m35 tables: Subcontractor isolated, MonitorAlert null rows stay visible (carve-out)', async () => {
    // Idempotent setup (re-runnable against the same scratch DB).
    await owner.monitorAlert.deleteMany({
      where: { key: { in: ['m35-biz', 'm35-platform'] } },
    });
    await owner.subcontractor.deleteMany({
      where: { name: { in: ['RLS Sub A', 'RLS Sub B'] } },
    });
    await owner.subcontractor.create({ data: { businessId: bizA, name: 'RLS Sub A' } });
    await owner.subcontractor.create({ data: { businessId: bizB, name: 'RLS Sub B' } });
    await owner.monitorAlert.create({
      data: { key: 'm35-biz', businessId: bizA, detail: 'tenant alert' },
    });
    await owner.monitorAlert.create({
      data: { key: 'm35-platform', businessId: null, detail: 'platform alert' },
    });

    // Tenant B sees only its own subcontractor...
    const subsB = await asTenant(bizB, (tx) =>
      tx.$queryRawUnsafe<Array<{ name: string }>>(`SELECT "name" FROM "Subcontractor"`)
    );
    assert.deepEqual(subsB.map((r) => r.name), ['RLS Sub B']);
    // ...and none of A's alerts, but DOES see the platform null-business
    // alert (the OR "businessId" IS NULL carve-out — without it, global
    // alerts would silently vanish under FORCE).
    const alertsB = await asTenant(bizB, (tx) =>
      tx.$queryRawUnsafe<Array<{ key: string }>>(`SELECT "key" FROM "MonitorAlert"`)
    );
    assert.deepEqual(alertsB.map((r) => r.key), ['m35-platform']);
    // Tenant A sees its own alert plus the platform row.
    const alertsA = await asTenant(bizA, (tx) =>
      tx.$queryRawUnsafe<Array<{ key: string }>>(`SELECT "key" FROM "MonitorAlert"`)
    );
    assert.deepEqual(
      alertsA.map((r) => r.key).sort(),
      ['m35-biz', 'm35-platform'],
    );
  });

  it('rollout coverage: every business table has its tenant policy', async () => {
    // GENERATED from prisma/schema.prisma (P1.0 Stage 1): every model with
    // a scalar businessId column must have a policy, so a new business
    // table can never again ship without one — the hardcoded list this
    // replaced omitted the 13 tables m35 adds, and the test passed while
    // they were unprotected. Parent-linked child tables have no businessId
    // column; they are listed explicitly with the parent each resolves via.
    const { readFileSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const schemaPath = join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      '..',
      'prisma',
      'schema.prisma',
    );
    const schemaText = readFileSync(schemaPath, 'utf8');
    const businessTables = new Set<string>();
    for (const m of schemaText.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
      const [, name, body] = m;
      if (/^\s*businessId\s+String\??\b/m.test(body)) businessTables.add(name);
    }
    // Spot-check the generation: the 13 tables m35 adds must be found.
    for (const t of [
      'BookableService',
      'BookingRequest',
      'JobAssignment',
      'VisitSignature',
      'MessageTemplateOverride',
      'DashboardLayout',
      'EmailVerificationToken',
      'ErrorLog',
      'MonitorAlert',
      'PortalEvent',
      'QuoteSignature',
      'QuoteTemplate',
      'Subcontractor',
    ]) {
      assert.ok(businessTables.has(t), `schema parse must find ${t}`);
    }
    // Child tables resolve their tenant via a parent row (see M11/M35).
    const childTables: string[] = [
      'InvoiceLineItem',
      'InvoiceTaxLine',
      'QuoteLineItem',
      'QuoteAddon',
      'JobNote',
      'JobPhoto',
      'JobChecklistItem',
      'ChecklistTemplateItem',
      'CrewMember',
      'WorkflowEvent',
      'WebhookDelivery',
      'CustomerFieldValue',
      'QuoteMessage',
      'ProjectPhase',
      'QuoteTemplateItem',
      'JobFieldValue',
      'PropertyFieldValue',
      'JobSubcontractor',
      'ConciergeSend',
    ];
    const expected: string[] = [...businessTables, ...childTables];
    const rows = (await owner.$queryRawUnsafe(
      `SELECT tablename FROM pg_policies WHERE policyname LIKE '%_tenant_isolation'`
    )) as { tablename: string }[];
    const have = new Set(rows.map((r) => r.tablename));
    const missing = expected.filter((t) => !have.has(t));
    assert.deepEqual(missing, [], `tables missing RLS tenant policy: ${missing.join(', ')}`);
  });
});
