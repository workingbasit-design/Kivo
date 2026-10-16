/**
 * Staging seed: realistic two-business dataset for staging/QA.
 *
 * - Business A (Ontario) + Business B (Quebec), each with owner + admin +
 *   dispatcher + technician (memberships), 3 consumer accounts, customers
 *   with addresses in ON/QC/BC/NS, jobs (past/today/future/no-date), quotes
 *   in every status, invoices (partial-paid, full-paid, voided), expenses
 *   with placeholder-PNG receipts.
 * - Idempotent: fixed stable IDs + upserts. Safe to re-run.
 * - NEVER runs against production: requires SEED_ALLOW_PROD=true for any
 *   non-local, non-staging host. Default (false) refuses anything that is
 *   not localhost or a *staging* host.
 *
 * Usage (staging):
 *   SEED_ALLOW_PROD=true DATABASE_URL="<staging url>" npx tsx scripts/seed-staging.ts
 */
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL ?? '';
const allowProd = process.env.SEED_ALLOW_PROD === 'true';
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
})();
const isLocal = host === 'localhost' || host === '127.0.0.1';
const isStaging = host.toLowerCase().includes('staging');
if (!isLocal && !isStaging && !allowProd) {
  console.error(
    `REFUSED: seed-staging.ts will not run against host "${host}" without SEED_ALLOW_PROD=true. ` +
      `This guard defaults to false to protect production.`
  );
  process.exit(1);
}
console.log(`Seeding staging data into ${url.replace(/:[^:@]*@/, ':***@')} (SEED_ALLOW_PROD=${allowProd})`);

const db = new PrismaClient({ datasources: { db: { url } } });
const SEED_PASSWORD = 'SeedPass123!';
const hashPassword = (pw: string) => {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};
const pwHash = hashPassword(SEED_PASSWORD);

// Tiny 1x1 transparent PNG (placeholder receipt — NOT a real receipt).
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const ASSET_DIR = new URL('./seed-assets/', import.meta.url).pathname;
function receiptAsset(name: string): string {
  mkdirSync(ASSET_DIR, { recursive: true });
  const p = `${ASSET_DIR}${name}`;
  if (!existsSync(p)) writeFileSync(p, PLACEHOLDER_PNG);
  return `seed-asset:${name}`;
}

const day = 86400000;
const now = Date.now();

async function main() {
  // ---------- Businesses ----------
  for (const [id, name, province] of [
    ['seed-biz-on', 'Maple Leaf Plumbing', 'ON'],
    ['seed-biz-qc', 'Plomberie Saint-Laurent', 'QC'],
  ] as const) {
    await db.business.upsert({
      where: { id },
      // F9: reports flag on for seeded businesses so e2e can exercise them.
      update: { name, featureFlags: '{"reports": true}' },
      create: { id, name, timezone: 'America/Toronto', featureFlags: '{"reports": true}' },
    });
    console.log(`business ${id} (${province})`);
  }

  // ---------- Users + memberships (owner/admin/dispatcher/technician per business) ----------
  const roles = ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN'] as const;
  for (const biz of ['seed-biz-on', 'seed-biz-qc'] as const) {
    for (const role of roles) {
      const email = `seed-${role.toLowerCase()}@${biz === 'seed-biz-on' ? 'mapleleaf' : 'stlaurent'}.example.ca`;
      const userId = `seed-user-${biz}-${role.toLowerCase()}`;
      await db.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, email, passwordHash: pwHash },
      });
      await db.membership.upsert({
        where: { id: `seed-mem-${biz}-${role.toLowerCase()}` },
        update: { role, status: 'ACTIVE' },
        create: {
          id: `seed-mem-${biz}-${role.toLowerCase()}`,
          userId,
          businessId: biz,
          role,
          status: 'ACTIVE',
        },
      });
    }
  }
  console.log('users + memberships seeded (password for all: SeedPass123!)');

  // ---------- Consumer accounts ----------
  for (let i = 1; i <= 3; i++) {
    await db.customerUser.upsert({
      where: { id: `seed-consumer-${i}` },
      update: {},
      create: {
        id: `seed-consumer-${i}`,
        email: `seed-consumer${i}@example.ca`,
        passwordHash: pwHash,
        locale: i === 3 ? 'fr' : 'en',
      },
    });
  }
  console.log('3 consumer accounts seeded');

  // ---------- Customers (ON/QC/BC/NS) ----------
  const customers: Array<[string, string, string, string, string, string]> = [
    // id, name, businessId, address, province, postal
    ['seed-cust-on-1', 'Alice Tremblay', 'seed-biz-on', '123 King St W, Toronto', 'ON', 'M5H 1J9'],
    ['seed-cust-on-2', 'Bob Singh', 'seed-biz-on', '456 Queen St E, Ottawa', 'ON', 'K1N 5T6'],
    ['seed-cust-qc-1', 'Claire Dubois', 'seed-biz-qc', '789 Rue Sainte-Catherine, Montréal', 'QC', 'H2X 1K9'],
    ['seed-cust-qc-2', 'David Roy', 'seed-biz-qc', '321 Boul Saint-Laurent, Québec', 'QC', 'G1K 3Y2'],
    ['seed-cust-bc-1', 'Emma Chen', 'seed-biz-on', '654 Robson St, Vancouver', 'BC', 'V6B 1A8'],
    ['seed-cust-ns-1', 'Frank MacDonald', 'seed-biz-qc', '987 Barrington St, Halifax', 'NS', 'B3J 1P8'],
  ];
  for (const [id, name, businessId, address, province, postalCode] of customers) {
    await db.customer.upsert({
      where: { id },
      update: { name, address, province, postalCode },
      create: { id, name, businessId, address, province, postalCode },
    });
  }
  console.log('6 customers seeded (ON/QC/BC/NS)');

  // ---------- Jobs: past / today / future / no-date ----------
  const jobSpecs: Array<[string, string, string, Date | null, string, number]> = [
    // id, title, customerId, date (null = unscheduled), status, priceCents
    ['seed-job-past', 'Water heater replacement', 'seed-cust-on-1', new Date(now - 30 * day), 'PAID', 185000],
    ['seed-job-today', 'Kitchen faucet leak', 'seed-cust-on-2', new Date(now), 'SCHEDULED', 22000],
    ['seed-job-future', 'Bathroom rough-in', 'seed-cust-qc-1', new Date(now + 7 * day), 'SCHEDULED', 340000],
    ['seed-job-nodate', 'Quote follow-up visit', 'seed-cust-qc-2', null, 'NEW', 0],
    ['seed-job-bc', 'Drain cleaning', 'seed-cust-bc-1', new Date(now - 3 * day), 'COMPLETED', 45000],
    ['seed-job-ns', 'Sump pump install', 'seed-cust-ns-1', new Date(now + 14 * day), 'SCHEDULED', 120000],
  ];
  for (const [id, title, customerId, date, status, priceCents] of jobSpecs) {
    const businessId = customerId.includes('qc') || customerId.includes('ns') ? 'seed-biz-qc' : 'seed-biz-on';
    await db.job.upsert({
      where: { id },
      update: { title, status, priceCents },
      create: {
        id,
        title,
        date: date ?? new Date(now),
        startAt: date,
        priceCents: BigInt(priceCents),
        status,
        customerId,
        businessId,
      },
    });
  }
  console.log('6 jobs seeded (past/today/future/no-date)');

  // ---------- Quotes in every status ----------
  const quoteStatuses = ['DRAFT', 'SENT', 'APPROVED', 'DECLINED'] as const;
  let qi = 0;
  for (const status of quoteStatuses) {
    qi++;
    const id = `seed-quote-${status.toLowerCase()}`;
    await db.quote.upsert({
      where: { id },
      update: { status },
      create: {
        id,
        number: `Q-SEED-${String(qi).padStart(3, '0')}`,
        title: `Seed quote (${status})`,
        totalCents: BigInt(99000),
        status,
        customerId: 'seed-cust-on-1',
        businessId: 'seed-biz-on',
      },
    });
  }
  console.log('4 quotes seeded (DRAFT/SENT/APPROVED/DECLINED)');

  // ---------- Invoices: partial-paid, full-paid, voided ----------
  const invSpecs: Array<[string, string, string, string, number]> = [
    // id, number, customerId, status, totalCents
    ['seed-inv-partial', 'INV-SEED-001', 'seed-cust-on-1', 'PARTIALLY PAID', 226000],
    ['seed-inv-paid', 'INV-SEED-002', 'seed-cust-qc-1', 'PAID', 113000],
    ['seed-inv-void', 'INV-SEED-003', 'seed-cust-on-2', 'VOID', 56500],
    ['seed-inv-unpaid', 'INV-SEED-004', 'seed-cust-ns-1', 'UNPAID', 79000],
  ];
  for (const [id, number, customerId, status, totalCents] of invSpecs) {
    const businessId = customerId.includes('qc') || customerId.includes('ns') ? 'seed-biz-qc' : 'seed-biz-on';
    await db.invoice.upsert({
      where: { id },
      update: { status },
      create: {
        id,
        number,
        date: new Date(now - 10 * day),
        dueAt: new Date(now + 20 * day),
        subtotalCents: BigInt(totalCents),
        taxAmountCents: BigInt(0),
        totalCents: BigInt(totalCents),
        status,
        customerId,
        businessId,
      },
    });
  }
  // partial + full payments
  await db.payment.upsert({
    where: { id: 'seed-pay-partial' },
    update: {},
    create: {
      id: 'seed-pay-partial',
      amountCents: BigInt(100000),
      provider: 'INTERAC',
      status: 'COMPLETED',
      invoiceId: 'seed-inv-partial',
      businessId: 'seed-biz-on',
    },
  });
  await db.payment.upsert({
    where: { id: 'seed-pay-full' },
    update: {},
    create: {
      id: 'seed-pay-full',
      amountCents: BigInt(113000),
      provider: 'INTERAC',
      status: 'COMPLETED',
      invoiceId: 'seed-inv-paid',
      businessId: 'seed-biz-qc',
    },
  });
  console.log('4 invoices + 2 payments seeded (partial/full/voided)');

  // ---------- Expenses with placeholder receipts ----------
  const expSpecs: Array<[string, string, string | null, number, string]> = [
    ['seed-exp-1', 'Copper fittings', 'seed-job-past', 8500, 'MATERIALS'],
    ['seed-exp-2', 'Mileage — service van', 'seed-job-bc', 3200, 'TRAVEL'],
    ['seed-exp-3', 'Pipe wrench set', null, 12900, 'OTHER'],
  ];
  let ei = 0;
  for (const [id, description, jobId, amountCents, category] of expSpecs) {
    ei++;
    const businessId = jobId === 'seed-job-bc' ? 'seed-biz-on' : 'seed-biz-on';
    await db.jobExpense.upsert({
      where: { id },
      update: { description, amountCents: BigInt(amountCents) },
      create: {
        id,
        description,
        jobId,
        businessId,
        amountCents: BigInt(amountCents),
        category,
        receiptUrl: receiptAsset(`seed-receipt-${ei}.png`),
        createdBy: 'system',
      },
    });
  }
  console.log('3 expenses seeded (placeholder PNG receipts in scripts/seed-assets/)');

  console.log('STAGING SEED COMPLETE. Login with any seed-*@*.example.ca / SeedPass123!');
}

main()
  .catch((e) => {
    console.error('SEED FAILED:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
