/**
 * DocumentCounter concurrency test (M4).
 *
 * 20 parallel invoice-number generations for one business must produce 20
 * distinct, sequential numbers with no duplicates. Needs a real Postgres
 * with the M4 migration applied. Skips unless TEST_DATABASE_URL is set
 * (CI runs this against the CI Postgres service). Never runs against
 * production - the URL is supplied by the caller and must be scratch.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { nextDocumentNumber } from '../numbering.ts';

const TEST_URL = process.env.TEST_DATABASE_URL;

describe('DocumentCounter concurrency (M4)', () => {
  if (!TEST_URL) {
    it('skipped - TEST_DATABASE_URL not set', () => {});
    return;
  }

  it('20 parallel generations -> 20 distinct sequential numbers', async () => {
    const url = TEST_URL.includes('connection_limit=')
      ? TEST_URL
      : `${TEST_URL}${TEST_URL.includes('?') ? '&' : '?'}connection_limit=25`;
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      const biz = await prisma.business.create({
        data: { name: 'numbering-concurrency-biz', timezone: 'America/Toronto' },
      });
      try {
        const results = await Promise.all(
          Array.from({ length: 20 }, () =>
            prisma.$transaction((tx) => nextDocumentNumber(tx, biz.id, 'INVOICE'))
          )
        );
        assert.equal(results.length, 20);
        assert.equal(new Set(results).size, 20, 'duplicate numbers generated');
        const sorted = [...results].sort();
        assert.deepEqual(
          sorted,
          Array.from({ length: 20 }, (_, i) => `INV-${String(i + 1).padStart(4, '0')}`),
          'numbers are not the sequential INV-0001..INV-0020'
        );
        const counter = await prisma.documentCounter.findUnique({
          where: { businessId_docType: { businessId: biz.id, docType: 'INVOICE' } },
        });
        assert.equal(counter?.nextNumber, 21);
      } finally {
        await prisma.business.delete({ where: { id: biz.id } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it('quote and credit-note counters are independent per doc type', async () => {
    const prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
    try {
      const biz = await prisma.business.create({
        data: { name: 'numbering-doctype-biz', timezone: 'America/Toronto' },
      });
      try {
        const q = await prisma.$transaction((tx) => nextDocumentNumber(tx, biz.id, 'QUOTE'));
        const c = await prisma.$transaction((tx) => nextDocumentNumber(tx, biz.id, 'CREDIT_NOTE'));
        assert.equal(q, 'Q-0001');
        assert.equal(c, 'CN-0001');
      } finally {
        await prisma.business.delete({ where: { id: biz.id } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });
});
