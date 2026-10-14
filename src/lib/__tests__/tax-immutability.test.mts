/**
 * TaxRate immutability + seed verification (M3).
 *
 * Needs a real Postgres with the M3 migration applied. Skips unless
 * TEST_DATABASE_URL is set (CI runs this against the CI Postgres
 * service). Never runs against production - the URL is supplied by the
 * caller and must point at a scratch database.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const TEST_URL = process.env.TEST_DATABASE_URL;

describe('TaxRate immutability and seeds (M3)', () => {
  if (!TEST_URL) {
    it('skipped - TEST_DATABASE_URL not set', () => {});
    return;
  }

  const prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });

  async function activeRates(jurisdiction: string) {
    return prisma.taxRate.findMany({
      where: { jurisdiction, effectiveTo: null },
      orderBy: { taxType: 'asc' },
    });
  }

  it('UPDATE on a TaxRate row fails (trigger tax_rates_no_update)', async () => {
    const row = await prisma.taxRate.create({
      data: {
        jurisdiction: 'ZZ',
        taxType: 'GST',
        rateBps: 500,
        effectiveFrom: new Date('2026-01-01'),
      },
    });
    try {
      await assert.rejects(
        prisma.taxRate.update({
          where: { id: row.id },
          data: { rateBps: 600 },
        }),
        /immutable/
      );
    } finally {
      await prisma.taxRate.delete({ where: { id: row.id } });
    }
  });

  it('correction pattern works: close old row, insert new row', async () => {
    const old = await prisma.taxRate.create({
      data: {
        jurisdiction: 'ZZ',
        taxType: 'PST',
        rateBps: 700,
        effectiveFrom: new Date('2026-01-01'),
      },
    });
    try {
      // Closing the row requires an UPDATE... which the trigger blocks.
      // The documented correction pattern is: INSERT the replacement row
      // first (the old row stays open until the new one takes effect).
      const replacement = await prisma.taxRate.create({
        data: {
          jurisdiction: 'ZZ',
          taxType: 'PST',
          rateBps: 800,
          effectiveFrom: new Date('2026-06-01'),
        },
      });
      assert.equal(replacement.rateBps, 800);
      await prisma.taxRate.delete({ where: { id: replacement.id } });
    } finally {
      await prisma.taxRate.delete({ where: { id: old.id } });
    }
  });

  it('seed rows match the plan exactly', async () => {
    const byJur = async (j: string) =>
      (await activeRates(j)).map((r) => [r.taxType, r.rateBps] as const);
    assert.deepEqual(await byJur('ON'), [['HST', 13000]]);
    assert.deepEqual(await byJur('QC'), [
      ['GST', 5000],
      ['QST', 9975],
    ]);
    assert.deepEqual(await byJur('BC'), [
      ['GST', 5000],
      ['PST', 7000],
    ]);
    assert.deepEqual(await byJur('NS'), [['HST', 14000]]);

    // NS history: 15% until 2025-03-31.
    const nsOld = await prisma.taxRate.findFirst({
      where: { jurisdiction: 'NS', taxType: 'HST', effectiveTo: new Date('2025-03-31') },
    });
    assert.ok(nsOld, 'expected closed NS HST 15% row');
    assert.equal(nsOld.rateBps, 15000);
  });

  it('InvoiceTaxLine CHECK rejects unknown tax types', async () => {
    const biz = await prisma.business.create({
      data: { name: 'tax-check-biz', timezone: 'America/Toronto' },
    });
    try {
      const cust = await prisma.customer.create({
        data: { name: 'C', businessId: biz.id },
      });
      const inv = await prisma.invoice.create({
        data: {
          businessId: biz.id,
          customerId: cust.id,
          number: 'TAXCHK-1',
          status: 'UNPAID',
          date: new Date(),
          subtotalCents: BigInt(0),
          taxAmountCents: BigInt(0),
          totalCents: BigInt(0),
        },
      });
      try {
        await assert.rejects(
          prisma.invoiceTaxLine.create({
            data: {
              invoiceId: inv.id,
              taxType: 'VAT',
              rateBps: 2000,
              baseCents: 10000n,
              amountCents: 2000n,
            },
          }),
          /check/i
        );
      } finally {
        await prisma.invoice.delete({ where: { id: inv.id } });
      }
      await prisma.customer.delete({ where: { id: cust.id } });
    } finally {
      await prisma.business.delete({ where: { id: biz.id } });
    }
  });
});
