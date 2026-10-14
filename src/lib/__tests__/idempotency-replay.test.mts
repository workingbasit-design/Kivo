/**
 * Idempotency replay tests (M6).
 *
 * Double-submit with the same Idempotency-Key: the work executes once,
 * the replay returns the stored response without re-executing.
 * Needs a real Postgres with the M6 migration applied. Skips unless
 * TEST_DATABASE_URL is set (CI runs this against the CI Postgres
 * service). Never runs against production.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { withIdempotency } from '../idempotency.ts';

const TEST_URL = process.env.TEST_DATABASE_URL;

describe('withIdempotency replay (M6)', () => {
  if (!TEST_URL) {
    it('skipped - TEST_DATABASE_URL not set', () => {});
    return;
  }

  const prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });

  async function setup() {
    const biz = await prisma.business.create({
      data: { name: 'idempotency-test-biz', timezone: 'America/Toronto' },
    });
    const cust = await prisma.customer.create({
      data: { name: 'C', businessId: biz.id },
    });
    const inv = await prisma.invoice.create({
      data: {
        businessId: biz.id,
        customerId: cust.id,
        number: 'IDEM-1',
        status: 'UNPAID',
        date: new Date(),
        subtotalCents: 10000n,
        taxAmountCents: BigInt(0),
        totalCents: 10000n,
      },
    });
    return { biz, inv };
  }

  async function teardown(bizId: string) {
    await prisma.payment.deleteMany({ where: { businessId: bizId } });
    await prisma.invoice.deleteMany({ where: { businessId: bizId } });
    await prisma.customer.deleteMany({ where: { businessId: bizId } });
    await prisma.idempotencyKey.deleteMany({ where: { businessId: bizId } });
    // Null-business keys created by the tests (tenant guard blocks the
    // ORM delete, so raw SQL is used — test-only cleanup).
    await prisma.$executeRawUnsafe(`DELETE FROM "IdempotencyKey" WHERE "businessId" IS NULL AND "key" LIKE 'idem-%'`);
    await prisma.business.delete({ where: { id: bizId } });
  }

  it('double-submit with the same key -> one Payment row, replayed response', async () => {
    const { biz, inv } = await setup();
    try {
      const scope = {
        businessId: biz.id,
        endpoint: 'POST /api/v1/payments',
        key: 'idem-key-1',
      };
      let executions = 0;
      const run = () =>
        withIdempotency(prisma, scope, async (tx) => {
          executions++;
          const payment = await tx.payment.create({
            data: {
              amountCents: 10000n,
              provider: 'OTHER',
              status: 'COMPLETED',
              invoiceId: inv.id,
              businessId: biz.id,
            },
          });
          return { response: { paymentId: payment.id, ok: true }, statusCode: 201 };
        });

      const first = await run();
      const second = await run();

      assert.equal(executions, 1, 'work must execute exactly once');
      assert.equal(first.replayed, false);
      assert.equal(second.replayed, true);
      assert.deepEqual(second.response, first.response);
      assert.equal(second.statusCode, 201);

      const payments = await prisma.payment.findMany({ where: { businessId: biz.id } });
      assert.equal(payments.length, 1, 'exactly one Payment row');
    } finally {
      await teardown(biz.id);
    }
  });

  it('different keys execute independently', async () => {
    const { biz, inv } = await setup();
    try {
      let executions = 0;
      for (const key of ['idem-key-a', 'idem-key-b']) {
        await withIdempotency(
          prisma,
          { businessId: biz.id, endpoint: 'POST /api/v1/payments', key },
          async (tx) => {
            executions++;
            await tx.payment.create({
              data: {
                amountCents: 5000n,
                provider: 'OTHER',
                status: 'COMPLETED',
                invoiceId: inv.id,
                businessId: biz.id,
              },
            });
            return { response: { ok: true }, statusCode: 201 };
          }
        );
      }
      assert.equal(executions, 2);
      const payments = await prisma.payment.findMany({ where: { businessId: biz.id } });
      assert.equal(payments.length, 2);
    } finally {
      await teardown(biz.id);
    }
  });

  it('null-business keys replay via the partial unique index', async () => {
    const { biz } = await setup();
    try {
      const scope = { businessId: null, endpoint: 'POST /api/public/quotes', key: 'idem-null-1' };
      let executions = 0;
      const run = () =>
        withIdempotency(prisma, scope, async () => {
          executions++;
          return { response: { queued: true }, statusCode: 202 };
        });
      const first = await run();
      const second = await run();
      assert.equal(executions, 1);
      assert.equal(first.replayed, false);
      assert.equal(second.replayed, true);
      assert.deepEqual(second.response, { queued: true });
    } finally {
      await teardown(biz.id);
    }
  });
});
