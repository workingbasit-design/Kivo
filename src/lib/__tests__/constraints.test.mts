/**
 * M10 constraint verification (DB-backed).
 *
 * Asserts the M10 CHECK / UNIQUE / RESTRICT constraints actually reject bad
 * data on a real Postgres, and that the Invoice.dueAt backfill statement
 * behaves as the migration defines it.
 *
 * Needs a real Postgres with the M10 migration applied. Skips unless
 * TEST_DATABASE_URL is set. Never runs against production - the URL is
 * supplied by the caller and must point at a scratch database.
 *
 * Run: TEST_DATABASE_URL=... node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/constraints.test.mts
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const TEST_URL = process.env.TEST_DATABASE_URL;

describe('M10 constraints', () => {
  if (!TEST_URL) {
    it('skipped - TEST_DATABASE_URL not set', () => {});
    return;
  }

  const prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
  const created: { model: 'business' | 'customer'; id: string }[] = [];

  async function makeBusiness(name: string) {
    const biz = await prisma.business.create({
      data: { name, timezone: 'America/Toronto' },
    });
    created.push({ model: 'business', id: biz.id });
    return biz;
  }

  async function makeCustomer(bizId: string) {
    const cust = await prisma.customer.create({
      data: { name: 'Constraint Co', businessId: bizId },
    });
    created.push({ model: 'customer', id: cust.id });
    return cust;
  }

  function baseInvoice(bizId: string, custId: string, number: string) {
    return {
      businessId: bizId,
      customerId: custId,
      number,
      date: new Date('2026-10-01T00:00:00Z'),
      subtotalCents: BigInt(10000),
      taxAmountCents: BigInt(1300),
      totalCents: BigInt(11300),
      status: 'UNPAID' as string,
    };
  }

  after(async () => {
    for (const row of created.reverse()) {
      if (row.model === 'customer') {
        await prisma.invoice.deleteMany({ where: { customerId: row.id } });
        await prisma.quote.deleteMany({ where: { customerId: row.id } });
        await prisma.customer.delete({ where: { id: row.id } }).catch(() => {});
      } else {
        await prisma.invoice.deleteMany({ where: { businessId: row.id } });
        await prisma.quote.deleteMany({ where: { businessId: row.id } });
        await prisma.payment.deleteMany({ where: { businessId: row.id } });
        await prisma.business.delete({ where: { id: row.id } }).catch(() => {});
      }
    }
    await prisma.$disconnect();
  });

  it('CHECK rejects a negative invoice total', async () => {
    const biz = await makeBusiness('chk-neg-inv');
    const cust = await makeCustomer(biz.id);
    await assert.rejects(
      prisma.invoice.create({
        data: { ...baseInvoice(biz.id, cust.id, 'CHK-1'), totalCents: BigInt(-100) },
      }),
      /check/i
    );
  });

  it('CHECK rejects a zero-amount payment', async () => {
    const biz = await makeBusiness('chk-zero-pay');
    const cust = await makeCustomer(biz.id);
    const inv = await prisma.invoice.create({
      data: baseInvoice(biz.id, cust.id, 'CHK-2'),
    });
    try {
      await assert.rejects(
        prisma.payment.create({
          data: {
            amountCents: BigInt(0),
            provider: 'CASH',
            status: 'COMPLETED',
            invoiceId: inv.id,
            businessId: biz.id,
          },
        }),
        /check/i
      );
    } finally {
      await prisma.invoice.delete({ where: { id: inv.id } });
    }
  });

  it('CHECK rejects an unknown invoice status', async () => {
    const biz = await makeBusiness('chk-bad-status');
    const cust = await makeCustomer(biz.id);
    await assert.rejects(
      prisma.invoice.create({
        data: { ...baseInvoice(biz.id, cust.id, 'CHK-3'), status: 'BOGUS' },
      }),
      /check/i
    );
  });

  it('CHECK accepts VOID status (M10 single source of truth)', async () => {
    const biz = await makeBusiness('chk-void');
    const cust = await makeCustomer(biz.id);
    const inv = await prisma.invoice.create({
      data: baseInvoice(biz.id, cust.id, 'CHK-4'),
    });
    const voided = await prisma.invoice.update({
      where: { id: inv.id },
      data: { status: 'VOID', voidedAt: new Date(), voidReason: 'test void' },
    });
    assert.equal(voided.status, 'VOID');
    await prisma.invoice.delete({ where: { id: inv.id } });
  });

  it('CHECK rejects a quote deposit greater than the total', async () => {
    const biz = await makeBusiness('chk-dep');
    const cust = await makeCustomer(biz.id);
    await assert.rejects(
      prisma.quote.create({
        data: {
          businessId: biz.id,
          customerId: cust.id,
          number: 'CHKQ-1',
          title: 't',
          totalCents: BigInt(10000),
          depositAmountCents: BigInt(10001),
          status: 'DRAFT',
        },
      }),
      /check/i
    );
  });

  it('CHECK rejects a PERCENT discount above 100', async () => {
    const biz = await makeBusiness('chk-disc');
    const cust = await makeCustomer(biz.id);
    await assert.rejects(
      prisma.quote.create({
        data: {
          businessId: biz.id,
          customerId: cust.id,
          number: 'CHKQ-2',
          title: 't',
          totalCents: BigInt(10000),
          discountType: 'PERCENT',
          discountValue: 150,
          status: 'DRAFT',
        },
      }),
      /check/i
    );
    // A valid percent passes.
    const q = await prisma.quote.create({
      data: {
        businessId: biz.id,
        customerId: cust.id,
        number: 'CHKQ-3',
        title: 't',
        totalCents: BigInt(10000),
        discountType: 'PERCENT',
        discountValue: 25,
        status: 'DRAFT',
      },
    });
    assert.equal(q.discountValue, 25);
  });

  it('CHECK rejects a zero-quantity line item', async () => {
    const biz = await makeBusiness('chk-qty');
    const cust = await makeCustomer(biz.id);
    const inv = await prisma.invoice.create({
      data: baseInvoice(biz.id, cust.id, 'CHK-5'),
    });
    try {
      await assert.rejects(
        prisma.invoiceLineItem.create({
          data: {
            invoiceId: inv.id,
            description: 'x',
            qty: 0,
            unitPriceCents: BigInt(100),
            position: 0,
          },
        }),
        /check/i
      );
    } finally {
      await prisma.invoice.delete({ where: { id: inv.id } });
    }
  });

  it('UNIQUE rejects a duplicate (businessId, number) on Invoice', async () => {
    const biz = await makeBusiness('chk-uniq');
    const cust = await makeCustomer(biz.id);
    await prisma.invoice.create({ data: baseInvoice(biz.id, cust.id, 'DUP-1') });
    await assert.rejects(
      prisma.invoice.create({ data: baseInvoice(biz.id, cust.id, 'DUP-1') }),
      /unique/i
    );
    // Same number in a DIFFERENT business is fine.
    const biz2 = await makeBusiness('chk-uniq-2');
    const cust2 = await makeCustomer(biz2.id);
    const ok = await prisma.invoice.create({
      data: baseInvoice(biz2.id, cust2.id, 'DUP-1'),
    });
    assert.equal(ok.number, 'DUP-1');
  });

  it('RESTRICT blocks deleting a Business that has invoices', async () => {
    const biz = await makeBusiness('chk-restrict');
    const cust = await makeCustomer(biz.id);
    await prisma.invoice.create({ data: baseInvoice(biz.id, cust.id, 'CHK-6') });
    await assert.rejects(
      prisma.business.delete({ where: { id: biz.id } }),
      /foreign key|restrict/i
    );
  });

  it('Invoice.dueAt backfill: sent invoices get date + 30 days, drafts get NULL', async () => {
    const biz = await makeBusiness('chk-dueat');
    const cust = await makeCustomer(biz.id);
    // Insert via raw SQL to bypass app code (which now sets dueAt itself),
    // then run the migration's backfill statement verbatim.
    const sentId = `chk-due-sent-${Date.now()}`;
    const draftId = `chk-due-draft-${Date.now()}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Invoice" ("id","businessId","customerId","number","date","subtotalCents","taxAmountCents","totalCents","status","taxRate","createdAt","updatedAt") VALUES ` +
        `('${sentId}','${biz.id}','${cust.id}','DUE-S','2026-10-01T00:00:00Z',10000,1300,11300,'UNPAID',13,NOW(),NOW()),` +
        `('${draftId}','${biz.id}','${cust.id}','DUE-D','2026-10-01T00:00:00Z',10000,1300,11300,'DRAFT',13,NOW(),NOW())`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "Invoice" SET "dueAt" = "date" + INTERVAL '30 days' WHERE "status" <> 'DRAFT' AND "id" IN ('${sentId}','${draftId}')`
    );
    const sent = await prisma.invoice.findUnique({ where: { id: sentId } });
    const draft = await prisma.invoice.findUnique({ where: { id: draftId } });
    assert.ok(sent?.dueAt, 'sent invoice should have dueAt');
    assert.equal(sent?.dueAt?.toISOString().slice(0, 10), '2026-10-31');
    assert.equal(draft?.dueAt, null);
    await prisma.invoice.deleteMany({ where: { id: { in: [sentId, draftId] } } });
  });
});
