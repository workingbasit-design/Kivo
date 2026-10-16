/**
 * F9 unit tests: pure report computations (src/lib/reports-f9.ts).
 * Run: node --test src/lib/__tests__/reports-f9.test.mts
 *
 * Acceptance mapping:
 *  F9-001 — aging bucket boundaries
 *  F9-002 — revenue invoiced vs collected (partial payments)
 *  F9-003 — tax by type and filing period
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agingBucketFor,
  daysPastDue,
  computeAging,
  computeRevenueByMonth,
  computeTaxByType,
  computeJobProfit,
  computeExpensesByCategory,
  computeLeadSources,
  monthKeyInTz,
  toCsv,
  centsToCsvDollars,
} from '../reports-f9.ts';

const DAY = 24 * 60 * 60 * 1000;

// --- F9-001: aging bucket boundaries ---------------------------------------

test('F9-001: aging buckets at exact boundaries', () => {
  assert.equal(agingBucketFor(-5), 'current');
  assert.equal(agingBucketFor(0), 'current');
  assert.equal(agingBucketFor(1), 'd1_30');
  assert.equal(agingBucketFor(30), 'd1_30');
  assert.equal(agingBucketFor(31), 'd31_60');
  assert.equal(agingBucketFor(60), 'd31_60');
  assert.equal(agingBucketFor(61), 'd61_90');
  assert.equal(agingBucketFor(90), 'd61_90');
  assert.equal(agingBucketFor(91), 'd90plus');
  assert.equal(agingBucketFor(400), 'd90plus');
});

test('F9-001: daysPastDue uses whole calendar days, future => 0', () => {
  const now = new Date('2026-10-16T12:00:00Z');
  assert.equal(daysPastDue(new Date('2026-10-16T00:00:00Z'), new Date('2026-10-01T00:00:00Z'), now), 0);
  assert.equal(daysPastDue(new Date('2026-10-15T23:59:59Z'), new Date('2026-10-01T00:00:00Z'), now), 1);
  assert.equal(daysPastDue(new Date('2026-10-20T00:00:00Z'), new Date('2026-10-01T00:00:00Z'), now), 0);
  // No due date => invoice date is the reference.
  assert.equal(daysPastDue(null, new Date('2026-09-01T00:00:00Z'), now), 45);
});

test('F9-001: computeAging skips fully-paid invoices, buckets the rest', () => {
  const now = new Date('2026-10-16T12:00:00Z');
  const d = (daysAgo: number) => new Date(now.getTime() - daysAgo * DAY);
  const summary = computeAging(
    [
      { id: 'a', totalCents: 10000, paidCents: 10000, dueAt: d(40), date: d(70) }, // paid => skipped
      { id: 'b', totalCents: 10000, paidCents: 4000, dueAt: d(10), date: d(40) }, // 6000 in 1-30
      { id: 'c', totalCents: 5000, paidCents: 0, dueAt: d(45), date: d(75) }, // 5000 in 31-60
      { id: 'd', totalCents: 2000, paidCents: 0, dueAt: null, date: d(100) }, // 2000 in 90+
    ],
    now,
  );
  assert.equal(summary.buckets.d1_30.outstandingCents, 6000);
  assert.equal(summary.buckets.d1_30.count, 1);
  assert.equal(summary.buckets.d31_60.outstandingCents, 5000);
  assert.equal(summary.buckets.d90plus.outstandingCents, 2000);
  assert.equal(summary.buckets.current.outstandingCents, 0);
  assert.equal(summary.totalOutstandingCents, 13000);
  assert.equal(summary.totalCount, 3);
});

// --- F9-002: revenue invoiced vs collected ----------------------------------

test('F9-002: invoiced by invoice month, collected by payment month (partial payments)', () => {
  const invoices = [
    { totalCents: 100000, date: new Date('2026-03-10T12:00:00Z') },
    { totalCents: 50000, date: new Date('2026-03-20T12:00:00Z') },
  ];
  const payments = [
    // Half of invoice 1 paid in March, the rest + invoice 2 in April.
    { amountCents: 50000, createdAt: new Date('2026-03-15T12:00:00Z') },
    { amountCents: 50000, createdAt: new Date('2026-04-02T12:00:00Z') },
    { amountCents: 50000, createdAt: new Date('2026-04-20T12:00:00Z') },
  ];
  const months = computeRevenueByMonth(invoices, payments, 2026, 'America/Toronto', 'en');
  const mar = months.find((m) => m.key === '2026-03')!;
  const apr = months.find((m) => m.key === '2026-04')!;
  assert.equal(mar.invoicedCents, 150000);
  assert.equal(mar.collectedCents, 50000);
  assert.equal(apr.invoicedCents, 0);
  assert.equal(apr.collectedCents, 100000);
  assert.equal(months.length, 12);
});

test('F9-002: month boundaries respect the business timezone', () => {
  // 2026-04-01 03:30 UTC is still March 31 in Toronto (UTC-4).
  const invoices = [{ totalCents: 10000, date: new Date('2026-04-01T03:30:00Z') }];
  const months = computeRevenueByMonth(invoices, [], 2026, 'America/Toronto', 'en');
  assert.equal(months.find((m) => m.key === '2026-03')!.invoicedCents, 10000);
  assert.equal(months.find((m) => m.key === '2026-04')!.invoicedCents, 0);
});

test('monthKeyInTz handles DST edges', () => {
  // Nov 1 2026 04:30 UTC = Nov 1 00:30 EDT (Toronto); Nov 1 05:30 UTC = 00:30 EST.
  assert.equal(monthKeyInTz(new Date('2026-11-01T04:30:00Z'), 'America/Toronto'), '2026-11');
  assert.equal(monthKeyInTz(new Date('2026-10-31T23:30:00Z'), 'America/Toronto'), '2026-10');
});

// --- F9-003: tax by type and period ------------------------------------------

test('F9-003: tax collected grouped by type and month', () => {
  const lines = [
    { taxType: 'GST', amountCents: 500, invoiceDate: new Date('2026-02-10T12:00:00Z') },
    { taxType: 'QST', amountCents: 997, invoiceDate: new Date('2026-02-10T12:00:00Z') },
    { taxType: 'GST', amountCents: 300, invoiceDate: new Date('2026-03-05T12:00:00Z') },
    { taxType: 'HST', amountCents: 1300, invoiceDate: new Date('2026-03-05T12:00:00Z') },
  ];
  const { rows, types, totals } = computeTaxByType(lines, 2026, 'America/Toronto', 'en');
  assert.deepEqual(types, ['GST', 'HST', 'QST']);
  const feb = rows.find((r) => r.key === '2026-02')!;
  const mar = rows.find((r) => r.key === '2026-03')!;
  assert.equal(feb.byType.GST, 500);
  assert.equal(feb.byType.QST, 997);
  assert.equal(feb.totalCents, 1497);
  assert.equal(mar.byType.HST, 1300);
  assert.equal(totals.GST, 800);
  assert.equal(totals.QST, 997);
  assert.equal(totals.HST, 1300);
  assert.equal(rows.length, 12);
});

// --- profitability -----------------------------------------------------------

test('job profit = revenue - costs, margin null on zero revenue, worst first', () => {
  const out = computeJobProfit([
    { id: 'a', title: 'Good', revenueCents: 100000, costCents: 30000 },
    { id: 'b', title: 'Bad', revenueCents: 50000, costCents: 60000 },
    { id: 'c', title: 'No invoices', revenueCents: 0, costCents: 5000 },
  ]);
  assert.equal(out[0].id, 'b'); // worst first
  assert.equal(out[0].profitCents, -10000);
  assert.equal(out[0].marginPct, -20);
  assert.equal(out[1].id, 'c');
  assert.equal(out[1].marginPct, null);
  assert.equal(out[2].id, 'a');
  assert.equal(out[2].marginPct, 70);
});

// --- expenses ----------------------------------------------------------------

test('expenses group by category with tax summed', () => {
  const rows = computeExpensesByCategory([
    { category: 'MATERIALS', amountCents: 10000, taxGstHstCents: 500, taxQstCents: 997, taxPstCents: 0 },
    { category: 'TRAVEL', amountCents: 2000, taxGstHstCents: 100, taxQstCents: 0, taxPstCents: 0 },
    { category: 'MATERIALS', amountCents: 5000, taxGstHstCents: 250, taxQstCents: 0, taxPstCents: 0 },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].category, 'MATERIALS'); // biggest first
  assert.equal(rows[0].amountCents, 15000);
  assert.equal(rows[0].taxCents, 1747);
  assert.equal(rows[0].count, 2);
});

// --- leads -------------------------------------------------------------------

test('lead sources with conversion rate; blank source grouped as unknown', () => {
  const { rows, total, converted, conversionPct } = computeLeadSources([
    { source: 'Website', status: 'CONVERTED' },
    { source: 'Website', status: 'NEW' },
    { source: 'Referral', status: 'CONVERTED' },
    { source: null, status: 'EXPIRED' },
    { source: '  ', status: 'NEW' },
  ]);
  assert.equal(total, 5);
  assert.equal(converted, 2);
  assert.equal(conversionPct, 40);
  const web = rows.find((r) => r.source === 'Website')!;
  assert.equal(web.total, 2);
  assert.equal(web.conversionPct, 50);
  const unknown = rows.find((r) => r.source === '(unknown)')!;
  assert.equal(unknown.total, 2);
  assert.equal(unknown.conversionPct, 0);
});

// --- CSV ---------------------------------------------------------------------

test('toCsv quotes commas, quotes and newlines; CRLF line endings', () => {
  const csv = toCsv(['Name', 'Amount'], [['Plain', 1], ['Has, comma', 2], ['Has "quote"', 3]]);
  assert.ok(csv.includes('"Has, comma"'));
  assert.ok(csv.includes('"Has ""quote"""'));
  assert.ok(csv.endsWith('\r\n'));
});

test('centsToCsvDollars formats 2dp dollars', () => {
  assert.equal(centsToCsvDollars(123456), '1234.56');
  assert.equal(centsToCsvDollars(5), '0.05');
});
