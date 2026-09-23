/**
 * Unit tests for the pure insights computation (src/lib/insights.ts).
 * No DB, no network — deterministic inputs, deterministic outputs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeInsights } from '../insights-compute.ts';

const NOW = new Date('2026-09-23T12:00:00Z');

const job = (over: Partial<Record<string, unknown>> = {}) => ({
  price: 100,
  status: 'COMPLETED',
  date: new Date('2026-08-15T10:00:00Z'),
  customerId: 'cust-1',
  technician: null as string | null,
  assignedTo: null as { name: string | null } | null,
  serviceId: 'svc-1',
  service: { name: 'Drain cleaning' },
  expenses: [] as { amount: number }[],
  ...over,
});

test('service margins subtract expenses and rank best-first', () => {
  const jobs = [
    job({ serviceId: 'svc-1', service: { name: 'Drain cleaning' }, price: 200, expenses: [{ amount: 50 }] }),
    job({ serviceId: 'svc-1', service: { name: 'Drain cleaning' }, price: 200, expenses: [{ amount: 50 }] }),
    job({ serviceId: 'svc-2', service: { name: 'Furnace tune-up' }, price: 100, expenses: [{ amount: 90 }] }),
    job({ serviceId: 'svc-2', service: { name: 'Furnace tune-up' }, price: 100, expenses: [] }),
    job({ serviceId: 'svc-3', service: { name: 'Draft job' }, price: 999, status: 'NEW' }),
  ];
  const ins = computeInsights([], jobs, [], 'en', NOW);
  assert.equal(ins.serviceMargins.length, 2); // draft job excluded
  assert.equal(ins.serviceMargins[0].name, 'Drain cleaning');
  assert.equal(ins.serviceMargins[0].margin, 300);
  assert.equal(ins.serviceMargins[0].marginPct, 75);
  assert.equal(ins.serviceMargins[1].name, 'Furnace tune-up');
  assert.equal(ins.serviceMargins[1].margin, 110);
});

test('customer lifetime value averages revenue and counts repeat customers', () => {
  const jobs = [
    job({ customerId: 'a', price: 100 }),
    job({ customerId: 'a', price: 200 }),
    job({ customerId: 'b', price: 300 }),
    job({ customerId: 'c', price: 50, status: 'CANCELLED' }), // excluded
  ];
  const ins = computeInsights([], jobs, [], 'en', NOW);
  assert.ok(ins.customerLifetimeValue);
  assert.equal(ins.customerLifetimeValue!.avgValue, 300);
  assert.equal(ins.customerLifetimeValue!.payingCustomers, 2);
  assert.equal(ins.customerLifetimeValue!.repeatRatePct, 50);
});

test('stale quotes are SENT quotes waiting 7+ days, with day counts', () => {
  const old = new Date('2026-09-01T10:00:00Z'); // 22 days before NOW
  const recent = new Date('2026-09-20T10:00:00Z'); // 3 days
  const quotes = [
    { id: 'q1', number: 'Q-001', total: 500, status: 'SENT', createdAt: old, customer: { name: 'Alice' } },
    { id: 'q2', number: 'Q-002', total: 150, status: 'SENT', createdAt: recent, customer: { name: 'Bob' } },
    { id: 'q3', number: 'Q-003', total: 900, status: 'APPROVED', createdAt: old, customer: { name: 'Carol' } },
  ];
  const ins = computeInsights([], [], quotes, 'en', NOW);
  assert.equal(ins.staleQuotes.length, 1);
  assert.equal(ins.staleQuotes[0].number, 'Q-001');
  assert.equal(ins.staleQuotes[0].daysWaiting, 22);
});

test('quote win rate uses only decided quotes', () => {
  const mk = (status: string) => ({
    id: status, number: status, total: 100, status,
    createdAt: NOW, customer: { name: 'X' },
  });
  const ins = computeInsights([], [], [mk('APPROVED'), mk('APPROVED'), mk('DECLINED'), mk('SENT'), mk('DRAFT')], 'en', NOW);
  assert.equal(ins.quoteWinRatePct, 66.7);
  const none = computeInsights([], [], [mk('SENT')], 'en', NOW);
  assert.equal(none.quoteWinRatePct, null);
});

test('busiest weekday comes from completed jobs only', () => {
  // 2026-08-15 is a Saturday (6), 2026-08-17 is a Monday (1)
  const jobs = [
    job({ date: new Date('2026-08-15T10:00:00Z') }),
    job({ date: new Date('2026-08-15T14:00:00Z') }),
    job({ date: new Date('2026-08-17T10:00:00Z') }),
    job({ date: new Date('2026-08-17T10:00:00Z'), status: 'CANCELLED' }),
  ];
  const ins = computeInsights([], jobs, [], 'en', NOW);
  assert.equal(ins.busiestWeekday, 6);
  assert.equal(ins.avgValueByWeekday[6], 100);
  assert.equal(ins.avgValueByWeekday[1], 100);
  assert.equal(ins.avgValueByWeekday[0], null);
});

test('technician utilization prefers assignedTo name and sorts by jobs', () => {
  const jobs = [
    job({ assignedTo: { name: 'Sam' }, technician: 'Fallback', price: 100 }),
    job({ assignedTo: { name: 'Sam' }, technician: 'Fallback', price: 200 }),
    job({ technician: 'Jo', price: 50 }),
    job({ technician: null, assignedTo: null, price: 10 }), // unattributed → excluded
  ];
  const ins = computeInsights([], jobs, [], 'en', NOW);
  assert.equal(ins.technicians.length, 2);
  assert.equal(ins.technicians[0].name, 'Sam');
  assert.equal(ins.technicians[0].revenue, 300);
  assert.equal(ins.technicians[1].name, 'Jo');
});

test('empty data returns nulls, not NaN or crashes', () => {
  const ins = computeInsights([], [], [], 'en', NOW);
  assert.equal(ins.revenueMomentumPct, null);
  assert.equal(ins.serviceMargins.length, 0);
  assert.equal(ins.customerLifetimeValue, null);
  assert.equal(ins.busiestWeekday, null);
  assert.equal(ins.quoteWinRatePct, null);
  assert.equal(ins.staleQuotes.length, 0);
  assert.equal(ins.basisJobs, 0);
});

test('revenue trend buckets payments by month and momentum compares complete months', () => {
  const payments = [
    { amount: 1000, createdAt: new Date('2026-07-10T10:00:00Z') },
    { amount: 1500, createdAt: new Date('2026-08-10T10:00:00Z') },
    { amount: 500, createdAt: new Date('2026-09-10T10:00:00Z') }, // current (incomplete) month
  ];
  const ins = computeInsights(payments, [], [], 'en', NOW);
  assert.equal(ins.revenueTrend.length, 6);
  const aug = ins.revenueTrend.find((p) => p.key === '2026-08');
  assert.equal(aug?.revenue, 1500);
  // momentum: Aug (1500) vs Jul (1000) → +50%
  assert.equal(ins.revenueMomentumPct, 50);
});

test('no fake data: unlinked jobs group under the no-service label, not invented names', () => {
  const jobs = [job({ serviceId: null, service: null, price: 120 })];
  const enIns = computeInsights([], jobs, [], 'en', NOW);
  assert.equal(enIns.serviceMargins[0].name, 'No service');
  const frIns = computeInsights([], jobs, [], 'fr', NOW);
  assert.equal(frIns.serviceMargins[0].name, 'Sans service');
});
