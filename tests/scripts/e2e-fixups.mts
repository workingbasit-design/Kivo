/**
 * E2E relative-date fixups (run by tests/scripts/seed-e2e.mjs after the base seed).
 *
 * Makes time-dependent assertions deterministic without touching the app clock:
 * creates/updates a small set of fixed-ID records with dates relative to "now".
 * Idempotent (upserts). Test-only database only — seed-e2e.mjs guards the host.
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const day = 86_400_000;
const now = new Date();
const atTime = (d: Date, h: number, m: number) => {
  const c = new Date(d);
  c.setHours(h, m, 0, 0);
  return c;
};

async function main() {
  // A job that started yesterday morning and is still SCHEDULED -> Late badge.
  const lateStart = atTime(new Date(now.getTime() - day), 9, 0);
  await db.job.upsert({
    where: { id: 'e2e-job-late' },
    update: { date: lateStart, startAt: lateStart, status: 'SCHEDULED' },
    create: {
      id: 'e2e-job-late',
      businessId: 'seed-biz-on',
      customerId: 'seed-cust-on-1',
      title: 'E2ETEST Late job',
      status: 'SCHEDULED',
      date: lateStart,
      startAt: lateStart,
      priceCents: BigInt(15000),
    },
  });

  // An invoice due yesterday, still UNPAID -> Overdue.
  // (Invoices have no SENT status — that is a quote status. Valid invoice
  // statuses per the M10 CHECK: DRAFT, UNPAID, PARTIALLY PAID, PAID, VOID.)
  const inv = await db.invoice.upsert({
    where: { id: 'e2e-inv-overdue' },
    update: { dueAt: new Date(now.getTime() - day), status: 'UNPAID' },
    create: {
      id: 'e2e-inv-overdue',
      businessId: 'seed-biz-on',
      customerId: 'seed-cust-on-1',
      number: 'INV-E2E-OVERDUE',
      status: 'UNPAID',
      date: new Date(now.getTime() - 10 * day),
      dueAt: new Date(now.getTime() - day),
      subtotalCents: BigInt(20000),
      taxAmountCents: BigInt(0),
      totalCents: BigInt(20000),
    },
  });
  console.log('fixups applied:', { lateJob: 'e2e-job-late', overdueInvoice: inv.id });

  // Known totals for Money/Dashboard reconciliation (seed-biz-on).
  const agg = await db.job.aggregate({
    where: { businessId: 'seed-biz-on', status: { not: 'CANCELLED' } },
    _sum: { priceCents: true },
    _count: true,
  });
  console.log('KNOWN TOTALS seed-biz-on jobs:', {
    count: agg._count,
    sumCents: agg._sum.priceCents?.toString() ?? '0',
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
