/**
 * M12 perf seed: 10,000 jobs (+ customers, invoices, payments, quotes) for
 * EXPLAIN ANALYZE before/after measurements. Scratch-local DB ONLY.
 *
 * Safety: refuses to run unless DATABASE_URL points at the local scratch
 * Postgres (127.0.0.1:54333). Never run against production.
 *
 * Usage: DATABASE_URL="postgresql://postgres@127.0.0.1:54333/kivo_scratch" npx tsx scripts/seed-perf.ts
 */
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL ?? '';
if (!url.includes('127.0.0.1:54333') && !url.includes('localhost:54333')) {
  console.error('REFUSED: seed-perf.ts only runs against the local scratch DB (127.0.0.1:54333).');
  process.exit(1);
}
console.log('Seeding perf data into', url.replace(/:[^:@]*@/, ':***@'));

const db = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  // Idempotent: wipe previous perf rows for the perf business first.
  await db.$executeRawUnsafe(`DELETE FROM "Payment" WHERE "businessId" = 'perf-biz'`);
  await db.$executeRawUnsafe(`DELETE FROM "Invoice" WHERE "businessId" = 'perf-biz'`);
  await db.$executeRawUnsafe(`DELETE FROM "Quote" WHERE "businessId" = 'perf-biz'`);
  await db.$executeRawUnsafe(`DELETE FROM "Job" WHERE "businessId" = 'perf-biz'`);
  await db.$executeRawUnsafe(`DELETE FROM "Customer" WHERE "businessId" = 'perf-biz'`);
  await db.$executeRawUnsafe(`DELETE FROM "Business" WHERE "id" = 'perf-biz'`);

  await db.$executeRawUnsafe(`
    INSERT INTO "Business" ("id","name","timezone","createdAt","updatedAt")
    VALUES ('perf-biz','Perf Test Co','America/Toronto',NOW(),NOW())`);

  await db.$executeRawUnsafe(`
    INSERT INTO "Customer" ("id","name","businessId","createdAt","updatedAt")
    SELECT 'perf-cust-'||g,
           'Customer '||g||CASE WHEN g % 10 = 0 THEN ' Smith' ELSE '' END,
           'perf-biz', NOW(), NOW()
    FROM generate_series(1,200) g`);

  // 10,000 jobs spread over ~180 days (past 90d + future 90d).
  await db.$executeRawUnsafe(`
    INSERT INTO "Job" ("id","title","date","startAt","endAt","priceCents","status","customerId","businessId","createdAt","updatedAt")
    SELECT 'perf-job-'||g,
           'Job '||g,
           d, d, d + interval '1 hour',
           (1000 + (g*37 % 50000))::bigint,
           (ARRAY['NEW','SCHEDULED','SCHEDULED','IN PROGRESS','COMPLETED','COMPLETED','PAID','CANCELLED'])[1 + (g % 8)],
           'perf-cust-'||(1 + (g % 200)),
           'perf-biz', NOW(), NOW()
    FROM generate_series(1,10000) g
    CROSS JOIN LATERAL (SELECT NOW() - interval '90 days' + ((g * 0.018) || ' days')::interval AS d) s`);

  // 3,000 invoices, unique numbers INV-000001.., dueAt = date + 30d (some overdue).
  await db.$executeRawUnsafe(`
    INSERT INTO "Invoice" ("id","number","date","dueAt","subtotalCents","taxAmountCents","totalCents","status","customerId","businessId","createdAt","updatedAt")
    SELECT 'perf-inv-'||g,
           'INV-'||lpad(g::text,6,'0'),
           d, d + interval '30 days',
           amt, (amt*13/100)::bigint, amt + (amt*13/100)::bigint,
           (ARRAY['DRAFT','UNPAID','UNPAID','PARTIALLY PAID','PAID','PAID'])[1 + (g % 6)],
           'perf-cust-'||(1 + (g % 200)), 'perf-biz', NOW(), NOW()
    FROM generate_series(1,3000) g
    CROSS JOIN LATERAL (
      SELECT NOW() - interval '120 days' + ((g * 0.05) || ' days')::interval AS d,
             (5000 + (g*53 % 200000))::bigint AS amt
    ) s`);

  // 1,500 payments against the invoices.
  await db.$executeRawUnsafe(`
    INSERT INTO "Payment" ("id","amountCents","provider","status","invoiceId","businessId","createdAt","updatedAt")
    SELECT 'perf-pay-'||g,
           (1000 + (g*29 % 50000))::bigint,
           'INTERAC', 'COMPLETED',
           'perf-inv-'||(1 + (g % 3000)),
           'perf-biz',
           NOW() - ((g * 0.05) || ' days')::interval, NOW()
    FROM generate_series(1,1500) g`);

  // 500 quotes, unique numbers Q-000001...
  await db.$executeRawUnsafe(`
    INSERT INTO "Quote" ("id","number","title","totalCents","status","customerId","businessId","createdAt","updatedAt")
    SELECT 'perf-quote-'||g,
           'Q-'||lpad(g::text,6,'0'),
           'Quote '||g,
           (5000 + (g*41 % 200000))::bigint,
           (ARRAY['DRAFT','SENT','SENT','APPROVED','DECLINED'])[1 + (g % 5)],
           'perf-cust-'||(1 + (g % 200)), 'perf-biz',
           NOW() - ((g * 0.1) || ' days')::interval, NOW()
    FROM generate_series(1,500) g`);

  const counts = (await db.$queryRawUnsafe(`
    SELECT (SELECT count(*) FROM "Job" WHERE "businessId"='perf-biz') AS jobs,
           (SELECT count(*) FROM "Customer" WHERE "businessId"='perf-biz') AS customers,
           (SELECT count(*) FROM "Invoice" WHERE "businessId"='perf-biz') AS invoices,
           (SELECT count(*) FROM "Payment" WHERE "businessId"='perf-biz') AS payments,
           (SELECT count(*) FROM "Quote" WHERE "businessId"='perf-biz') AS quotes
  `)) as Array<Record<string, unknown>>;
  console.log('seeded:', counts[0]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
