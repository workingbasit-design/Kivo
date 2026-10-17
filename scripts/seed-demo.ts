/**
 * Part 0 (dashboard rebuild): seed a realistic demo business.
 *
 * Creates a SEPARATE business ("Maple Leaf Home Services (Demo)", id demo-biz)
 * with six months of history for a Toronto-area home services company:
 * 4 trades (cleaning, gutters, furnace/HVAC tune-ups, window washing),
 * ~350 jobs, 3 technicians, ~120 customers with GTA addresses, quotes in
 * every status, invoices (paid / partial / unpaid / overdue) with payments,
 * leads with response times, and expenses with receipts.
 *
 * - Reproducible: fixed random seed (mulberry32) + dates relative to "today"
 *   in America/Toronto, so screenshots can be repeated and the demo always
 *   looks current. See src/lib/demo-seed.ts.
 * - Idempotent: fixed stable ids + upserts. Safe to re-run.
 * - NEVER runs against production: refuses any host that is not localhost or
 *   *staging* unless SEED_ALLOW_PROD=true (same guard as seed-staging.ts).
 *
 * Usage (local):
 *   DATABASE_URL=<redacted> node --experimental-strip-types scripts/seed-demo.ts
 *   # or: npm run seed:demo   (uses DATABASE_URL from .env)
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  mulberry32,
  seededPick,
  seededInt,
  todayToronto,
  torontoWallToUtc,
  torontoDatePlusDays,
} from '../src/lib/demo-seed.ts';

// ---------- Safety guard (same shape as seed-staging.ts) ----------
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
if (!url) {
  console.error('REFUSED: DATABASE_URL is not set.');
  process.exit(1);
}
if (!isLocal && !isStaging && !allowProd) {
  console.error(
    `REFUSED: seed-demo.ts will not run against host "${host}" without SEED_ALLOW_PROD=true. ` +
      `The demo business must never be seeded into production.`
  );
  process.exit(1);
}
console.log(`Seeding demo business into ${url.replace(/:[^:@]*@/, ':***@')}`);

const db = new PrismaClient({ datasources: { db: { url } } });
const rng = mulberry32(20261017);
const pick = <T,>(arr: readonly T[]): T => seededPick(rng, arr);
const int = (min: number, max: number): number => seededInt(rng, min, max);

const SEED_PASSWORD = 'DemoPass123!';
// The app verifies passwords with bcrypt (src/app/actions/auth.ts) — the
// seed must use the same format or logins fail.
const pwHash = await bcrypt.hash(SEED_PASSWORD, 10);

// Tiny 1x1 transparent PNG (placeholder receipt — same as seed-staging).
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

const BIZ = 'demo-biz';
const today = todayToronto();
const HST_BPS = 13000; // Ontario HST 13%
const hstOn = (subtotalCents: number) => Math.round((subtotalCents * HST_BPS) / 100000);

// ---------- Trades / services ----------
const TRADES: Array<{ key: string; services: Array<{ name: string; price: number }> }> = [
  {
    key: 'cleaning',
    services: [
      { name: 'Deep clean, 3 bedroom', price: 24900 },
      { name: 'Move-out clean', price: 34900 },
      { name: 'Recurring home cleaning', price: 14900 },
    ],
  },
  {
    key: 'gutters',
    services: [
      { name: 'Gutter cleaning', price: 18900 },
      { name: 'Downspout repair', price: 12900 },
    ],
  },
  {
    key: 'hvac',
    services: [
      { name: 'Furnace tune-up', price: 14900 },
      { name: 'AC maintenance visit', price: 16900 },
    ],
  },
  {
    key: 'windows',
    services: [
      { name: 'Window washing, full home', price: 19900 },
      { name: 'Exterior window clean', price: 13900 },
    ],
  },
] as const;

// ---------- Customer pools (GTA) ----------
const FIRST = ['Daniel','Priya','Marc','Sofia','Wei','Emma','Liam','Olivia','Noah','Ava','Lucas','Mia','Ethan','Zara','Arjun','Fatima','Omar','Yuki','Chloe','Nathan','Aisha','Vikram','Hannah','Gabriel','Léa','Félix','Camille','Antoine','Sarah','David','Rachel','Michael','Jessica','Thomas','Ashley','Kevin','Laura','Jason','Nadia','Igor','Elena','Marco','Giulia','Tariq','Samira','Kenji','Mei','Diego','Lucia','Pierre','Marie','Jean','Sophie','Alexandre','Isabelle','Hugo','Emma','Louis','Jade','Adam','Eva','Noah','Liam','Olivia','Ava','Lucas'] as const;
const LAST = ['Okafor','Shah','Tremblay','Rossi','Chen','Singh','Dubois','Roy','MacDonald','Kim','Patel','Nguyen','Cohen','Bouchard','Gagnon','Lafleur','Khan','Ahmed','Silva','Costa','Ferreira','Wong','Li','Zhang','Brown','Wilson','Taylor','Anderson','Thomas','Jackson','White','Harris','Martin','Garcia','Robinson','Clark','Lewis','Lee','Walker','Hall','Allen','Young','King','Wright','Scott','Green','Baker','Adams','Nelson','Hill','Campbell','Mitchell','Roberts','Carter','Phillips','Evans','Turner','Parker','Collins','Edwards','Stewart','Morris','Murphy','Cook','Rogers','Bell','Kelly','Ward','Cox','Richardson','Wood','Watson','Brooks','Bennett','Gray','James','Price','Myers','Long','Foster','Sanders','Ross','Powell','Sullivan','Russell','Jenkins','Perry','Barnes','Fisher','Coleman','Simmons','Patterson','Jordan','Reynolds','Hamilton'] as const;
// [street, city, postal area]
const STREETS = [
  ['King St W','Toronto','M5V'],['Queen St E','Toronto','M4M'],['Danforth Ave','Toronto','M4K'],
  ['Bloor St W','Toronto','M6P'],['Yonge St','Toronto','M4W'],['College St','Toronto','M5T'],
  ['Roncesvalles Ave','Toronto','M6R'],['Davenport Rd','Toronto','M6H'],['St Clair Ave W','Toronto','M6C'],
  ['Eglinton Ave W','Etobicoke','M9C'],['Dundas St W','Etobicoke','M8Z'],['The Queensway','Etobicoke','M8Y'],
  ['Kipling Ave','Etobicoke','M8Z'],['Finch Ave E','North York','M2N'],['Sheppard Ave E','North York','M2J'],
  ['Yonge St','North York','M2M'],['Victoria Park Ave','Scarborough','M1R'],['Kingston Rd','Scarborough','M1N'],
  ['Markham Rd','Scarborough','M1H'],['Dixie Rd','Mississauga','L4W'],['Hurontario St','Mississauga','L5B'],
  ['Burnhamthorpe Rd','Mississauga','L5C'],['Main St S','Brampton','L6W'],['Queen St E','Brampton','L6W'],
  ['Yonge St','Richmond Hill','L4C'],['Leslie St','Richmond Hill','L4B'],['McCowan Rd','Markham','L3P'],
  ['Highway 7','Markham','L3R'],['Jane St','Vaughan','L4K'],['Major Mackenzie Dr','Vaughan','L6A'],
  ['Lakeshore Rd W','Oakville','L6K'],['Dundas St E','Oakville','L6H'],['Dundas St W','Toronto','M6P'],
] as const;
const AREA = ['416','647','905'] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

async function main() {
  // ---------- Business ----------
  await db.business.upsert({
    where: { id: BIZ },
    update: {
      name: 'Maple Leaf Home Services (Demo)',
      isDemo: true,
      timezone: 'America/Toronto',
      currency: 'CAD',
      regionCode: 'CA',
      taxRegion: 'ON',
      gstHstRegistered: true,
      taxId: '123456789RT0001',
      onboardingDone: true,
      teamSize: '2-5',
      directoryOptIn: false,
      featureFlags: '{"reports": true}',
    },
    create: {
      id: BIZ,
      name: 'Maple Leaf Home Services (Demo)',
      isDemo: true,
      timezone: 'America/Toronto',
      currency: 'CAD',
      regionCode: 'CA',
      taxRegion: 'ON',
      gstHstRegistered: true,
      taxId: '123456789RT0001',
      onboardingDone: true,
      teamSize: '2-5',
      directoryOptIn: false,
      featureFlags: '{"reports": true}',
    },
  });
  console.log('business demo-biz (Demo)');

  // ---------- Users + memberships ----------
  const people = [
    { id: 'demo-user-owner', email: 'demo-owner@example.ca', name: 'Alex Morgan', role: 'OWNER' },
    { id: 'demo-user-jay', email: 'demo-jay.m@example.ca', name: 'Jay M.', role: 'TECHNICIAN' },
    { id: 'demo-user-ana', email: 'demo-ana.r@example.ca', name: 'Ana R.', role: 'TECHNICIAN' },
    { id: 'demo-user-sam', email: 'demo-sam.k@example.ca', name: 'Sam K.', role: 'TECHNICIAN' },
  ] as const;
  for (const p of people) {
    await db.user.upsert({
      where: { id: p.id },
      update: { name: p.name, email: p.email, passwordHash: pwHash },
      create: { id: p.id, email: p.email, passwordHash: pwHash, name: p.name },
    });
    await db.membership.upsert({
      where: { id: `demo-mem-${p.id.replace('demo-user-', '')}` },
      update: { role: p.role, status: 'ACTIVE' },
      create: {
        id: `demo-mem-${p.id.replace('demo-user-', '')}`,
        userId: p.id,
        businessId: BIZ,
        role: p.role,
        status: 'ACTIVE',
      },
    });
  }
  console.log('4 users + memberships (password for all: DemoPass123!)');
  const techIds = ['demo-user-jay', 'demo-user-ana', 'demo-user-sam'];

  // ---------- Document counters ----------
  for (const [docType, prefix, next] of [
    ['INVOICE', 'INV-', 300],
    ['QUOTE', 'Q-', 30],
    ['CREDIT_NOTE', 'CN-', 1],
  ] as const) {
    await db.documentCounter.upsert({
      where: { businessId_docType: { businessId: BIZ, docType } },
      update: {},
      create: { businessId: BIZ, docType, prefix, nextNumber: next },
    });
  }

  // ---------- Services (price book) ----------
  const serviceIds: string[] = [];
  let si = 0;
  for (const trade of TRADES) {
    for (const s of trade.services) {
      si++;
      const id = `demo-svc-${si}`;
      serviceIds.push(id);
      await db.service.upsert({
        where: { id },
        update: { name: s.name, priceCents: BigInt(s.price), category: trade.key },
        create: {
          id,
          name: s.name,
          priceCents: BigInt(s.price),
          category: trade.key,
          businessId: BIZ,
        },
      });
    }
  }
  console.log(`${serviceIds.length} services seeded`);

  // ---------- Customers (~120) ----------
  const fixedCustomers = [
    { id: 'demo-cust-001', name: 'Daniel Okafor', address: '1423 Eglinton Ave W, Etobicoke', province: 'ON', postalCode: 'M9C 1H4', phone: '(416) 555-0142' },
    { id: 'demo-cust-002', name: 'Priya Shah', address: '5080 Dixie Rd, Mississauga', province: 'ON', postalCode: 'L4W 4H2', phone: '(905) 555-0188' },
    { id: 'demo-cust-003', name: 'Marc Tremblay', address: '2107 Finch Ave E, North York', province: 'ON', postalCode: 'M2N 2R4', phone: '(416) 555-0119' },
    { id: 'demo-cust-004', name: 'Sofia Rossi', address: '3050 Dundas St W, Toronto', province: 'ON', postalCode: 'M6P 2H8', phone: '(647) 555-0163' },
  ];
  const customerIds: string[] = [];
  for (const c of fixedCustomers) {
    customerIds.push(c.id);
    await db.customer.upsert({
      where: { id: c.id },
      update: { name: c.name, address: c.address, province: c.province, postalCode: c.postalCode, phone: c.phone },
      create: { id: c.id, name: c.name, businessId: BIZ, address: c.address, province: c.province, postalCode: c.postalCode, phone: c.phone, createdBy: 'system' },
    });
  }
  const usedNames = new Set(fixedCustomers.map((c) => c.name));
  for (let i = 5; i <= 120; i++) {
    const id = `demo-cust-${String(i).padStart(3, '0')}`;
    customerIds.push(id);
    let name = `${pick(FIRST)} ${pick(LAST)}`;
    let guard = 0;
    while (usedNames.has(name) && guard++ < 20) name = `${pick(FIRST)} ${pick(LAST)}`;
    usedNames.add(name);
    const [street, city, area] = pick(STREETS);
    const num = int(12, 9890);
    const postal = `${area} ${int(0,9)}${'ABCEGHJKLMNPRSTVWXYZ'[int(0,19)]}${int(0,9)}`;
    const phone = rng() < 0.85 ? `(${pick(AREA)}) 555-0${int(100,199)}` : null;
    await db.customer.upsert({
      where: { id },
      update: { name, address: `${num} ${street}, ${city}`, province: 'ON', postalCode: postal, phone },
      create: {
        id, name, businessId: BIZ,
        address: `${num} ${street}, ${city}`,
        province: 'ON', postalCode: postal, phone,
        email: rng() < 0.6 ? `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.ca` : null,
        createdBy: 'system',
      },
    });
  }
  console.log('120 customers seeded (GTA addresses)');

  // ---------- Jobs (~350) ----------
  // Fixed "today" jobs (match the rhythm of a real workday).
  const todayJobs: Array<{ id: string; h: number; mi: number; svc: number; cust: string; tech: string | null; status: string }> = [
    { id: 'demo-job-today-1', h: 8, mi: 30, svc: 3, cust: 'demo-cust-001', tech: 'demo-user-jay', status: 'COMPLETED' },
    { id: 'demo-job-today-2', h: 11, mi: 0, svc: 0, cust: 'demo-cust-002', tech: 'demo-user-ana', status: 'COMPLETED' },
    { id: 'demo-job-today-3', h: 14, mi: 30, svc: 5, cust: 'demo-cust-003', tech: null, status: 'SCHEDULED' },
    { id: 'demo-job-today-4', h: 16, mi: 0, svc: 7, cust: 'demo-cust-004', tech: 'demo-user-jay', status: 'SCHEDULED' },
  ];
  let jobSeq = 0;
  const mkJobId = () => `demo-job-${String(++jobSeq).padStart(3, '0')}`;

  async function upsertJob(o: {
    id: string; title: string; customerId: string; serviceId: string;
    at: Date; status: string; priceCents: number; tech: string | null; tbd?: boolean;
  }) {
    await db.job.upsert({
      where: { id: o.id },
      update: { title: o.title, status: o.status, priceCents: BigInt(o.priceCents), startAt: o.at, date: o.at, assignedToId: o.tech, timeTbd: !!o.tbd },
      create: {
        id: o.id, title: o.title, customerId: o.customerId, businessId: BIZ,
        serviceId: o.serviceId, date: o.at, startAt: o.at,
        // Toronto wall-clock HH:MM (seed window is all EDT = UTC-4).
        time: `${pad2((o.at.getUTCHours() + 20) % 24)}:${pad2(o.at.getUTCMinutes())}`,
        timeTbd: !!o.tbd, status: o.status, priceCents: BigInt(o.priceCents),
        assignedToId: o.tech, createdBy: 'system',
      },
    });
  }
  const svcPrice = (idx: number) => {
    const all = TRADES.flatMap((t) => t.services);
    return all[idx].price;
  };
  const svcName = (idx: number) => {
    const all = TRADES.flatMap((t) => t.services);
    return all[idx].name;
  };

  for (const j of todayJobs) {
    const at = torontoWallToUtc(today.y, today.m, today.d, j.h, j.mi);
    const price = Math.round(svcPrice(j.svc) * (0.9 + rng() * 0.2));
    await upsertJob({ id: j.id, title: svcName(j.svc), customerId: j.cust, serviceId: serviceIds[j.svc], at, status: j.status, priceCents: price, tech: j.tech });
  }

  // Generated jobs: 300 past (8–180d), 16 recent (1–7d), 30 future (1–14d).
  // Job.status is CHECK-constrained to NEW|SCHEDULED|IN PROGRESS|COMPLETED|PAID|CANCELLED;
  // payment state lives on the invoice, tracked separately here.
  type GenJob = { id: string; at: Date; status: string; invoiceStatus: string | null; priceCents: number; customerId: string; serviceId: string; tech: string | null; tbd: boolean };
  const genJobs: GenJob[] = [];
  function genJob(daysOffset: number, status: string, invoiceStatus: string | null = null): GenJob {
    const svcIdx = int(0, serviceIds.length - 1);
    const base = svcPrice(svcIdx);
    const price = Math.round(base * (0.85 + rng() * 0.4));
    const h = int(8, 16);
    const mi = pick([0, 15, 30, 45] as const);
    // daysOffset > 0 = past, < 0 = future (negative flips the shift).
    const d = torontoDatePlusDays(today, -daysOffset);
    const at = torontoWallToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), h, mi);
    return {
      id: mkJobId(), at, status, invoiceStatus, priceCents: price,
      customerId: pick(customerIds), serviceId: serviceIds[svcIdx],
      tech: rng() < 0.7 ? pick(techIds) : null,
      tbd: rng() < 0.1,
    };
  }
  // [count, jobStatus, invoiceStatus]
  const pastBuckets: Array<[number, string, string | null]> = [
    [234, 'PAID', 'PAID'],
    [12, 'COMPLETED', 'PARTIALLY PAID'],
    [15, 'COMPLETED', 'UNPAID'],
    [24, 'COMPLETED', null], // done, not invoiced — "ready to invoice" pool
    [15, 'CANCELLED', null],
  ];
  for (const [count, status, invoiceStatus] of pastBuckets) {
    for (let i = 0; i < count; i++) genJobs.push(genJob(int(8, 180), status, invoiceStatus));
  }
  const recentBuckets: Array<[number, string, string | null]> = [
    [6, 'PAID', 'PAID'],
    [2, 'COMPLETED', 'PARTIALLY PAID'],
    [2, 'COMPLETED', 'UNPAID'],
    [4, 'IN PROGRESS', null],
    [2, 'COMPLETED', null],
  ];
  for (const [count, status, invoiceStatus] of recentBuckets) {
    for (let i = 0; i < count; i++) genJobs.push(genJob(int(1, 7), status, invoiceStatus));
  }
  for (let i = 0; i < 30; i++) genJobs.push(genJob(-int(1, 14), rng() < 0.9 ? 'SCHEDULED' : 'NEW'));
  for (const g of genJobs) {
    await upsertJob({ id: g.id, title: svcName(serviceIds.indexOf(g.serviceId)), customerId: g.customerId, serviceId: g.serviceId, at: g.at, status: g.status, priceCents: g.priceCents, tech: g.tech, tbd: g.tbd });
  }
  const allJobs = [...todayJobs.map((j) => ({ id: j.id, status: j.status })), ...genJobs.map((g) => ({ id: g.id, status: g.status }))];
  console.log(`${allJobs.length} jobs seeded`);

  // ---------- Invoices + payments ----------
  // Invoice every PAID / PARTIALLY PAID / UNPAID job; leave COMPLETED jobs
  // uninvoiced ("ready to invoice" pool).
  let invSeq = 0;
  let paySeq = 0;
  for (const g of genJobs.filter((j) => j.invoiceStatus !== null)) {
    invSeq++;
    const invId = `demo-inv-${String(invSeq).padStart(3, '0')}`;
    const number = `INV-${String(invSeq).padStart(4, '0')}`;
    const invDate = new Date(g.at.getTime() + int(0, 2) * 86400000);
    const dueAt = new Date(invDate.getTime() + 30 * 86400000);
    const tax = hstOn(g.priceCents);
    const total = g.priceCents + tax;
    // A few UNPAID invoices are overdue for the aging demo.
    const overdue = g.invoiceStatus === 'UNPAID' && rng() < 0.5;
    const due = overdue ? new Date(Date.now() - int(10, 45) * 86400000) : dueAt;
    const invStatus = g.invoiceStatus as string;
    await db.invoice.upsert({
      where: { id: invId },
      update: { status: invStatus, dueAt: due },
      create: {
        id: invId, number, businessId: BIZ, customerId: g.customerId, jobId: g.id,
        date: invDate, dueAt: due,
        subtotalCents: BigInt(g.priceCents), taxAmountCents: BigInt(tax), totalCents: BigInt(total),
        taxRate: 13, taxType: 'HST', status: invStatus, createdBy: 'system',
      },
    });
    await db.invoiceLineItem.upsert({
      where: { id: `${invId}-li1` },
      update: {},
      create: {
        id: `${invId}-li1`, invoiceId: invId,
        description: svcName(serviceIds.indexOf(g.serviceId)),
        qty: 1, unitPriceCents: BigInt(g.priceCents),
        taxRateBps: HST_BPS, taxType: 'HST', position: 1,
      },
    });
    await db.invoiceTaxLine.upsert({
      where: { id: `${invId}-tax1` },
      update: {},
      create: {
        id: `${invId}-tax1`, invoiceId: invId,
        taxType: 'HST', rateBps: HST_BPS,
        baseCents: BigInt(g.priceCents), amountCents: BigInt(tax),
      },
    });
    const payAt = (daysAfter: number) => {
      const d = new Date(invDate.getTime() + daysAfter * 86400000);
      return d.getTime() > Date.now() ? new Date(Date.now() - 3600000) : d;
    };
    if (invStatus === 'PAID') {
      paySeq++;
      await db.payment.upsert({
        where: { id: `demo-pay-${String(paySeq).padStart(3, '0')}` },
        update: {},
        create: {
          id: `demo-pay-${String(paySeq).padStart(3, '0')}`,
          amountCents: BigInt(total), provider: pick(['INTERAC', 'CHEQUE', 'CASH'] as const),
          status: 'COMPLETED', invoiceId: invId, businessId: BIZ,
          createdAt: payAt(int(3, 25)), createdBy: 'system',
        },
      });
    } else if (invStatus === 'PARTIALLY PAID') {
      paySeq++;
      const part = Math.round(total * (0.4 + rng() * 0.2));
      await db.payment.upsert({
        where: { id: `demo-pay-${String(paySeq).padStart(3, '0')}` },
        update: {},
        create: {
          id: `demo-pay-${String(paySeq).padStart(3, '0')}`,
          amountCents: BigInt(part), provider: pick(['INTERAC', 'CASH'] as const),
          status: 'COMPLETED', invoiceId: invId, businessId: BIZ,
          createdAt: payAt(int(3, 15)), createdBy: 'system',
        },
      });
    }
  }
  // Fix the counters to sit past the seeded numbers.
  await db.documentCounter.update({
    where: { businessId_docType: { businessId: BIZ, docType: 'INVOICE' } },
    data: { nextNumber: invSeq + 1 },
  });
  console.log(`${invSeq} invoices + ${paySeq} payments seeded`);

  // ---------- Quotes (every status) ----------
  const quoteStatuses = ['DRAFT', 'SENT', 'APPROVED', 'DECLINED'] as const;
  const quoteTitles: Record<(typeof quoteStatuses)[number], string[]> = {
    DRAFT: ['Furnace tune-up + filter', 'Full home window washing'],
    SENT: ['Gutter cleaning, two-storey', 'Deep clean, 4 bedroom', 'AC maintenance visit'],
    APPROVED: ['Move-out clean', 'Downspout repair'],
    DECLINED: ['Recurring home cleaning, monthly', 'Exterior window clean'],
  };
  let qSeq = 0;
  for (const status of quoteStatuses) {
    const n = status === 'SENT' ? 8 : 5;
    for (let i = 0; i < n; i++) {
      qSeq++;
      const qid = `demo-quote-${String(qSeq).padStart(2, '0')}`;
      const svcIdx = int(0, serviceIds.length - 1);
      const total = Math.round(svcPrice(svcIdx) * (0.9 + rng() * 0.3));
      const createdAt = torontoDatePlusDays(today, -int(2, 60));
      await db.quote.upsert({
        where: { id: qid },
        update: { status },
        create: {
          id: qid, number: `Q-${String(qSeq).padStart(4, '0')}`,
          title: pick(quoteTitles[status]), totalCents: BigInt(total), status,
          customerId: pick(customerIds), businessId: BIZ,
          createdAt, createdBy: 'system',
        },
      });
      await db.quoteLineItem.upsert({
        where: { id: `${qid}-li1` },
        update: {},
        create: {
          id: `${qid}-li1`, quoteId: qid,
          description: svcName(svcIdx), qty: 1, unitPriceCents: BigInt(total),
          taxRateBps: HST_BPS, taxType: 'HST', position: 1,
        },
      });
    }
  }
  await db.documentCounter.update({
    where: { businessId_docType: { businessId: BIZ, docType: 'QUOTE' } },
    data: { nextNumber: qSeq + 1 },
  });
  console.log(`${qSeq} quotes seeded (DRAFT/SENT/APPROVED/DECLINED)`);

  // ---------- Leads (with response-time data) ----------
  const leadSources = ['Website', 'Phone', 'WhatsApp'] as const;
  const leadNames = ['Hannah Kim', 'Gabriel Roy', 'Léa Bouchard', 'Omar Haddad', 'Yuki Tanaka', 'Chloe Martin', 'Nathan Cohen', 'Aisha Khan', 'Vikram Mehta', 'Félix Gagnon', 'Camille Roy', 'Antoine Lefebvre', 'Sarah Wilson', 'David Kim', 'Rachel Green', 'Michael Brown'];
  const leadSpecs: Array<{ status: string; hoursAgo: number }> = [
    { status: 'NEW', hoursAgo: 0.7 }, { status: 'NEW', hoursAgo: 2 }, { status: 'NEW', hoursAgo: 5 },
    { status: 'NEW', hoursAgo: 26 }, { status: 'NEW', hoursAgo: 49 }, { status: 'NEW', hoursAgo: 73 },
    { status: 'CONTACTED', hoursAgo: 30 }, { status: 'CONTACTED', hoursAgo: 55 },
    { status: 'CONTACTED', hoursAgo: 80 }, { status: 'CONTACTED', hoursAgo: 120 },
    { status: 'CONVERTED', hoursAgo: 200 }, { status: 'CONVERTED', hoursAgo: 340 }, { status: 'CONVERTED', hoursAgo: 500 },
    { status: 'EXPIRED', hoursAgo: 700 }, { status: 'EXPIRED', hoursAgo: 900 }, { status: 'EXPIRED', hoursAgo: 1100 },
  ];
  let li = 0;
  for (const spec of leadSpecs) {
    li++;
    const lid = `demo-lead-${String(li).padStart(2, '0')}`;
    const createdAt = new Date(Date.now() - spec.hoursAgo * 3600000);
    const name = leadNames[li - 1];
    const phone = `(${pick(AREA)}) 555-0${int(200, 299)}`;
    await db.lead.upsert({
      where: { id: lid },
      update: { status: spec.status },
      create: {
        id: lid, name, businessId: BIZ, phone,
        email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.ca`,
        details: pick(['Furnace not heating evenly', 'Gutters overflowing in rain', 'Windows haven\'t been cleaned in years', 'Need a deep clean before moving', 'AC blowing warm air'] as const),
        status: spec.status, source: pick(leadSources), createdAt, createdBy: 'system',
      },
    });
    // Response-time trail: NEW leads are still waiting; CONTACTED leads got
    // a first reply 12–95 minutes after they arrived.
    if (spec.status === 'NEW') {
      await db.communication.upsert({
        where: { id: `${lid}-comm` },
        update: {},
        create: {
          id: `${lid}-comm`, type: pick(['CALL', 'WHATSAPP', 'SMS'] as const),
          contactName: name, contactPhone: phone, status: 'WAITING',
          waitingSince: createdAt, businessId: BIZ, createdAt,
        },
      });
    } else if (spec.status === 'CONTACTED') {
      const repliedAt = new Date(createdAt.getTime() + int(12, 95) * 60000);
      await db.communication.upsert({
        where: { id: `${lid}-comm` },
        update: {},
        create: {
          id: `${lid}-comm`, type: pick(['CALL', 'WHATSAPP', 'SMS'] as const),
          contactName: name, contactPhone: phone, status: 'REPLIED',
          waitingSince: createdAt, content: 'Thanks for getting back to me — Thursday works.',
          businessId: BIZ, createdAt, updatedAt: repliedAt,
        },
      });
    }
  }
  console.log(`${li} leads seeded (NEW/CONTACTED/CONVERTED/EXPIRED)`);

  // ---------- Expenses (with receipts) ----------
  const expenseSpecs = [
    ['HVAC filters, box of 12', 'MATERIALS', 8400], ['Cleaning supplies restock', 'MATERIALS', 12600],
    ['Gutter screws and sealant', 'MATERIALS', 4300], ['Window squeegee blades', 'MATERIALS', 2800],
    ['Furnace igniter parts', 'MATERIALS', 15200], ['Microfiber cloths, pack', 'MATERIALS', 3600],
    ['Mileage — service van', 'TRAVEL', 5200], ['Fuel, service van', 'TRAVEL', 8900],
    ['Parking downtown jobs', 'TRAVEL', 1800], ['Ladder repair', 'OTHER', 7400],
    ['Work uniforms, 3 sets', 'OTHER', 18900], ['Phone bill', 'OTHER', 9500],
    ['Insurance, monthly', 'OTHER', 32000], ['Tool replacement set', 'MATERIALS', 11400],
    ['Gutter hangers, box', 'MATERIALS', 6700], ['Descaler solution', 'MATERIALS', 4100],
    ['Safety cones, 4 pack', 'OTHER', 5600], ['Coffee for crew', 'OTHER', 2400],
    ['Extension pole, 24ft', 'MATERIALS', 13800], ['Van wash', 'TRAVEL', 2200],
  ] as const;
  let ei = 0;
  const pastJobIds = genJobs.filter((j) => j.status !== 'CANCELLED').map((j) => j.id);
  for (const [desc, category, amount] of expenseSpecs) {
    ei++;
    const eid = `demo-exp-${String(ei).padStart(2, '0')}`;
    const jobId = ei <= 12 ? pastJobIds[int(0, pastJobIds.length - 1)] : null;
    const spentAt = torontoDatePlusDays(today, -int(2, 170));
    const tax = Math.round((amount * 13) / 100);
    await db.jobExpense.upsert({
      where: { id: eid },
      update: { description: desc, amountCents: BigInt(amount) },
      create: {
        id: eid, description: desc, businessId: BIZ, jobId,
        amountCents: BigInt(amount), category,
        spentAt, receiptUrl: receiptAsset(`demo-receipt-${ei}.png`),
        taxGstHstCents: BigInt(tax), createdBy: 'system',
      },
    });
  }
  console.log(`${ei} expenses seeded (placeholder receipts)`);

  console.log('DEMO SEED COMPLETE.');
  console.log('Login: demo-owner@example.ca / DemoPass123!  (technicians: demo-jay.m / demo-ana.r / demo-sam.k @example.ca)');
}

main()
  .catch((e) => {
    console.error('SEED FAILED:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
