/**
 * Regression tests for the 2026-10-10 QA duplicate-customer bug:
 * Postgres `contains` is case-SENSITIVE, so the candidate fetch returned zero
 * rows when the draft name differed in case from the stored customer name
 * (draft "Qatest Copilot Customer" vs stored "QATEST Copilot Customer") and
 * the confirm path created a duplicate customer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import {
  findCustomerNameCandidates,
  exactNameMatch,
} from '../copilot/match-customer.ts';

function stubPrisma(rows: { id: string; name: string }[]) {
  const calls: unknown[] = [];
  const prisma = {
    customer: {
      findMany: async (args: unknown) => {
        calls.push(args);
        // Simulate Postgres semantics for the check below: the stub applies
        // the args the way Prisma would, so a case-sensitive `contains`
        // without mode:'insensitive' would return [] here too.
        const where = (args as { where?: { name?: { contains?: string; mode?: string } } })
          .where?.name;
        const needle = where?.contains ?? '';
        const insensitive = where?.mode === 'insensitive';
        return rows.filter((r) =>
          insensitive
            ? r.name.toLowerCase().includes(needle.toLowerCase())
            : r.name.includes(needle)
        );
      },
    },
  } as unknown as PrismaClient;
  return { prisma, calls };
}

test('findCustomerNameCandidates passes mode:insensitive to Prisma', async () => {
  const { prisma, calls } = stubPrisma([]);
  await findCustomerNameCandidates(prisma, 'biz-1', 'Qatest Copilot Customer');
  assert.equal(calls.length, 1);
  const where = (calls[0] as { where: { businessId: string; name: object } }).where;
  assert.equal(where.businessId, 'biz-1');
  assert.deepEqual(where.name, {
    contains: 'Qatest Copilot Customer',
    mode: 'insensitive',
  });
});

test('case-only name difference still finds the stored customer (no duplicate)', async () => {
  const { prisma } = stubPrisma([{ id: 'c1', name: 'QATEST Copilot Customer' }]);
  const candidates = await findCustomerNameCandidates(
    prisma,
    'biz-1',
    'Qatest Copilot Customer'
  );
  assert.equal(candidates.length, 1);
  const exact = exactNameMatch(candidates, 'Qatest Copilot Customer');
  assert.ok(exact);
  assert.equal(exact.id, 'c1');
  assert.equal(exact.name, 'QATEST Copilot Customer');
});

test('exactNameMatch trims whitespace before comparing', () => {
  const exact = exactNameMatch(
    [{ id: 'c1', name: 'QATEST Copilot Customer' }],
    '  qatest copilot customer  '
  );
  assert.ok(exact);
});

test('exactNameMatch does not match a partial name', () => {
  const exact = exactNameMatch(
    [{ id: 'c1', name: 'QATEST Copilot Customer' }],
    'QATEST Copilot'
  );
  assert.equal(exact, null);
});

test('exactNameMatch returns null when there are no candidates', () => {
  assert.equal(exactNameMatch([], 'Anyone'), null);
});
