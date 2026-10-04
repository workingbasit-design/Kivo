/**
 * Tests for the attention engine (src/lib/attention.ts).
 * Pure function over plain data — no DB, no network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAttention, sortAttention, type AttentionInput } from '../attention.ts';

const DAY = 86_400_000;
const NOW = new Date('2026-10-04T14:00:00-04:00'); // Oct 4 2026, 2pm Toronto

function baseInput(over: Partial<AttentionInput> = {}): AttentionInput {
  return {
    now: NOW,
    timezone: 'America/Toronto',
    invoices: [],
    quotes: [],
    jobs: [],
    leads: [],
    parts: [],
    paidThisWeek: { count: 0, total: 0 },
    ...over,
  };
}

const inv = (over = {}) => ({
  id: 'inv1',
  number: 'INV-1',
  date: new Date(NOW.getTime() - 45 * DAY), // 45 days ago -> 15 days overdue (Net-30)
  total: 500,
  paidTotal: 0,
  status: 'UNPAID',
  customerName: 'Alice',
  ...over,
});

test('overdue invoice produces an attention item with the balance', () => {
  const items = computeAttention(baseInput({ invoices: [inv()] }));
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'invoice-inv1');
  assert.equal(items[0].severity, 'attention'); // 15 days overdue
  assert.equal(items[0].amount, 500);
  assert.equal(items[0].titleKey, 'items.overdueInvoice.title');
});

test('invoice overdue more than 30 days is critical', () => {
  const items = computeAttention(
    baseInput({ invoices: [inv({ id: 'inv2', date: new Date(NOW.getTime() - 75 * DAY) })] })
  );
  assert.equal(items[0].severity, 'critical');
});

test('paid and not-yet-overdue invoices produce nothing', () => {
  const items = computeAttention(
    baseInput({
      invoices: [
        inv({ id: 'a', status: 'PAID' }),
        inv({ id: 'b', date: new Date(NOW.getTime() - 10 * DAY) }),
      ],
    })
  );
  assert.equal(items.length, 0);
});

test('partially paid invoice uses the remaining balance', () => {
  const items = computeAttention(
    baseInput({ invoices: [inv({ total: 500, paidTotal: 200 })] })
  );
  assert.equal(items[0].amount, 300);
});

test('sent quote idle past the follow-up window is flagged', () => {
  const items = computeAttention(
    baseInput({
      quotes: [
        {
          id: 'q1',
          number: 'Q-1',
          title: 'Reno',
          total: 2000,
          status: 'SENT',
          updatedAt: new Date(NOW.getTime() - 5 * DAY),
          customerName: 'Bob',
        },
      ],
    })
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].category, 'quotes');
  assert.equal(items[0].detailParams.days, 5);
});

test('draft quotes and fresh sent quotes are not flagged', () => {
  const items = computeAttention(
    baseInput({
      quotes: [
        { id: 'q1', number: 'Q-1', title: 'x', total: 1, status: 'DRAFT', updatedAt: new Date(NOW.getTime() - 30 * DAY), customerName: 'B' },
        { id: 'q2', number: 'Q-2', title: 'x', total: 1, status: 'SENT', updatedAt: new Date(NOW.getTime() - 1 * DAY), customerName: 'B' },
      ],
    })
  );
  assert.equal(items.length, 0);
});

const job = (over = {}) => ({
  id: 'j1',
  title: 'Fix sink',
  date: new Date('2026-10-04T09:00:00-04:00'),
  status: 'SCHEDULED',
  price: 150,
  technician: 'Mike',
  customerName: 'Cara',
  hasInvoice: true,
  ...over,
});

test('job scheduled in the past that never started is critical', () => {
  const items = computeAttention(
    baseInput({ jobs: [job({ date: new Date('2026-10-01T09:00:00-04:00') })] })
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].severity, 'critical');
  assert.equal(items[0].category, 'jobs');
});

test('unassigned job today is flagged for dispatch', () => {
  const items = computeAttention(baseInput({ jobs: [job({ technician: null })] }));
  assert.equal(items.length, 1);
  assert.equal(items[0].category, 'schedule');
  assert.equal(items[0].href, '/dispatch');
});

test('completed job without an invoice is unbilled work', () => {
  const items = computeAttention(
    baseInput({ jobs: [job({ status: 'COMPLETED', hasInvoice: false })] })
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].amount, 150);
  assert.equal(items[0].ctaKey, 'actions.createInvoice');
});

test('in-progress and invoiced jobs are quiet', () => {
  const items = computeAttention(
    baseInput({
      jobs: [
        job({ status: 'IN PROGRESS' }),
        job({ status: 'COMPLETED', hasInvoice: true }),
      ],
    })
  );
  assert.equal(items.length, 0);
});

test('new lead idle over a day is flagged; fresh lead is not', () => {
  const items = computeAttention(
    baseInput({
      leads: [
        { id: 'l1', name: 'Dan', status: 'NEW', createdAt: new Date(NOW.getTime() - 30 * 3_600_000), source: 'Website' },
        { id: 'l2', name: 'Eve', status: 'NEW', createdAt: new Date(NOW.getTime() - 2 * 3_600_000), source: 'Phone' },
        { id: 'l3', name: 'Fin', status: 'CONTACTED', createdAt: new Date(NOW.getTime() - 99 * 3_600_000), source: 'Phone' },
      ],
    })
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'lead-l1');
});

test('low stock is info; out of stock is attention', () => {
  const items = computeAttention(
    baseInput({
      parts: [
        { id: 'p1', name: 'Filter', quantity: 2, reorderPoint: 5 },
        { id: 'p2', name: 'Valve', quantity: 0, reorderPoint: 3 },
        { id: 'p3', name: 'Pipe', quantity: 99, reorderPoint: 5 },
        { id: 'p4', name: 'Tape', quantity: 1, reorderPoint: null },
      ],
    })
  );
  assert.equal(items.length, 2);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(byId['part-p1'].severity, 'info');
  assert.equal(byId['part-p2'].severity, 'attention');
});

test('paid invoices this week show up as good news', () => {
  const items = computeAttention(
    baseInput({ paidThisWeek: { count: 3, total: 1200 } })
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].severity, 'positive');
});

test('empty business gets an empty list, not noise', () => {
  assert.deepEqual(computeAttention(baseInput()), []);
});

test('sorting: critical first, then attention, then positive; money sorts by amount', () => {
  const items = sortAttention([
    { id: 'p', severity: 'positive', category: 'money', titleKey: 't', titleParams: {}, detailKey: 'd', detailParams: {}, href: '/', ctaKey: 'c', amount: 99999 },
    { id: 'a2', severity: 'attention', category: 'money', titleKey: 't', titleParams: {}, detailKey: 'd', detailParams: {}, href: '/', ctaKey: 'c', amount: 100 },
    { id: 'c1', severity: 'critical', category: 'jobs', titleKey: 't', titleParams: {}, detailKey: 'd', detailParams: {}, href: '/', ctaKey: 'c' },
    { id: 'a1', severity: 'attention', category: 'money', titleKey: 't', titleParams: {}, detailKey: 'd', detailParams: {}, href: '/', ctaKey: 'c', amount: 500 },
  ]);
  assert.deepEqual(
    items.map((i) => i.id),
    ['c1', 'a1', 'a2', 'p']
  );
});
