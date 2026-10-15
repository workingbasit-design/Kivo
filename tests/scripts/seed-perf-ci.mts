/**
 * CI perf seed: 10,000 jobs + 5,000 customers for P4-P-002.
 *
 * Creates business `perf-biz` with an owner login (perf-owner@test.ca /
 * SeedPass123!) — the perf.spec.ts logs in as this user.
 *
 * Usage: TEST_DATABASE_URL=<ci-db> node --experimental-strip-types tests/scripts/seed-perf-ci.mts
 * Refuses non-test hosts (same guard as seed-e2e).
 */
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const TEST_URL = process.env.TEST_DATABASE_URL ?? '';
if (!TEST_URL) {
  console.error('REFUSED: TEST_DATABASE_URL is not set.');
  process.exit(1);
}
const host = new URL(TEST_URL).hostname;
if (!['localhost', '127.0.0.1'].includes(host)) {
  console.error(`REFUSED: host "${host}" is not a local test database.`);
  process.exit(1);
}

const db = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
const BIZ = 'perf-biz';

async function main() {
  // Idempotent: wipe first.
  await db.job.deleteMany({ where: { businessId: BIZ } });
  await db.customer.deleteMany({ where: { businessId: BIZ } });
  await db.membership.deleteMany({ where: { businessId: BIZ } });
  await db.business.deleteMany({ where: { id: BIZ } });
  await db.user.deleteMany({ where: { email: 'perf-owner@test.ca' } });

  await db.business.create({ data: { id: BIZ, name: 'Perf Test Co', timezone: 'America/Toronto' } });
  const user = await db.user.create({
    data: { id: 'perf-user', email: 'perf-owner@test.ca', passwordHash: await hash('SeedPass123!', 10) },
  });
  await db.membership.create({
    data: { id: 'perf-mem', userId: user.id, businessId: BIZ, role: 'OWNER', status: 'ACTIVE' },
  });

  // 5,000 customers in batches.
  const now = Date.now();
  for (let batch = 0; batch < 10; batch++) {
    await db.customer.createMany({
      data: Array.from({ length: 500 }, (_, i) => {
        const n = batch * 500 + i;
        return { id: `perf-cust-${n}`, name: `Perf Customer ${n}`, businessId: BIZ };
      }),
    });
  }
  console.log('5,000 customers seeded');

  // 10,000 jobs in batches.
  for (let batch = 0; batch < 20; batch++) {
    await db.job.createMany({
      data: Array.from({ length: 500 }, (_, i) => {
        const n = batch * 500 + i;
        return {
          id: `perf-job-${n}`,
          title: `Perf Job ${n}`,
          businessId: BIZ,
          customerId: `perf-cust-${n % 5000}`,
          date: new Date(now - (n % 30) * 86400000),
          priceCents: BigInt(10000 + (n % 90000)),
          status: ['NEW', 'SCHEDULED', 'IN PROGRESS', 'COMPLETED', 'PAID'][n % 5],
        };
      }),
    });
  }
  console.log('10,000 jobs seeded');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
