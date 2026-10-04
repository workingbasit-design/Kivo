/**
 * Tests for money leaks (src/lib/money-leaks.ts) and the business health
 * score (src/lib/health-score.ts). Pure functions over plain data.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMoneyLeaks,
  measuredLeakTotal,
  type MoneyLeakInput,
} from '../money-leaks.ts';
import { computeHealthScore, type HealthInput } from '../health-score.ts';

const NOW = new Date('2026-10-04T14:00:00-04:00');

function leakInput(over: Partial<MoneyLeakInput> = {}): MoneyLeakInput {
  return {
    now: NOW,
    timezone: 'America/Toronto',
    overdueInvoices: [],
    unbilledJobs: [],
    idleQuotes: [],
    ...over,
  };
}

// --- money leaks ---

test('overdue invoices are a measured leak with count and max days', () => {
  const leaks = computeMoneyLeaks(
    leakInput({
      overdueInvoices: [
        { balance: 400, daysOverdue: 12 },
        { balance: 100, daysOverdue: 45 },
      ],
    })
  );
  assert.equal(leaks.length, 1);
  assert.equal(leaks[0].id, 'overdue');
  assert.equal(leaks[0].amount, 500);
  assert.equal(leaks[0].count, 2);
  assert.equal(leaks[0].measured, true);
  assert.equal(leaks[0].detailParams.days, 45);
});

test('unbilled completed jobs are a measured leak', () => {
  const leaks = computeMoneyLeaks(
    leakInput({ unbilledJobs: [{ price: 150 }, { price: 250 }] })
  );
  assert.equal(leaks[0].id, 'unbilled');
  assert.equal(leaks[0].amount, 400);
  assert.equal(leaks[0].measured, true);
});

test('idle quotes are an estimate, not a measured loss', () => {
  const leaks = computeMoneyLeaks(
    leakInput({ idleQuotes: [{ total: 2000, daysWaiting: 9 }] })
  );
  assert.equal(leaks[0].id, 'idleQuotes');
  assert.equal(leaks[0].measured, false);
  assert.equal(leaks[0].amount, 2000);
});

test('leaks sort by amount descending; empty input gives no leaks', () => {
  const leaks = computeMoneyLeaks(
    leakInput({
      overdueInvoices: [{ balance: 100, daysOverdue: 5 }],
      unbilledJobs: [{ price: 900 }],
    })
  );
  assert.deepEqual(
    leaks.map((l) => l.id),
    ['unbilled', 'overdue']
  );
  assert.deepEqual(computeMoneyLeaks(leakInput()), []);
});

test('measuredLeakTotal excludes estimates', () => {
  const leaks = computeMoneyLeaks(
    leakInput({
      overdueInvoices: [{ balance: 100, daysOverdue: 5 }],
      idleQuotes: [{ total: 5000, daysWaiting: 9 }],
    })
  );
  assert.equal(measuredLeakTotal(leaks), 100);
});

// --- health score ---

function healthInput(over: Partial<HealthInput> = {}): HealthInput {
  return {
    receivables: [],
    newLeads14d: 0,
    openQuotes: 0,
    jobsCompleted60d: 0,
    jobsScheduled60d: 0,
    revenue90d: 0,
    expenses90d: 0,
    ...over,
  };
}

test('perfect cash flow when nothing is overdue', () => {
  const h = computeHealthScore(
    healthInput({
      receivables: [{ total: 1000, overdueBalance: 0 }],
    })
  );
  const cash = h.subs.find((s) => s.key === 'cashFlow')!;
  assert.equal(cash.score, 100);
});

test('cash flow degrades as overdue share grows', () => {
  const h = computeHealthScore(
    healthInput({
      receivables: [{ total: 1000, overdueBalance: 500 }],
    })
  );
  const cash = h.subs.find((s) => s.key === 'cashFlow')!;
  assert.equal(cash.score, 0); // 50% overdue -> 100 - 50*2
  assert.equal(cash.explainParams.overduePct, 50);
});

test('pipeline scores from recent demand and caps at 100', () => {
  const low = computeHealthScore(healthInput({ newLeads14d: 1, openQuotes: 1 }));
  assert.equal(low.subs.find((s) => s.key === 'pipeline')!.score, 20);
  const high = computeHealthScore(healthInput({ newLeads14d: 10, openQuotes: 10 }));
  assert.equal(high.subs.find((s) => s.key === 'pipeline')!.score, 100);
});

test('operations is the completion rate; null without scheduled jobs', () => {
  const h = computeHealthScore(
    healthInput({ jobsCompleted60d: 8, jobsScheduled60d: 10 })
  );
  assert.equal(h.subs.find((s) => s.key === 'operations')!.score, 80);
  const empty = computeHealthScore(healthInput());
  assert.equal(empty.subs.find((s) => s.key === 'operations')!.score, null);
});

test('profitability is margin on paid revenue vs expenses; null without revenue', () => {
  const h = computeHealthScore(
    healthInput({ revenue90d: 10000, expenses90d: 3000 })
  );
  assert.equal(h.subs.find((s) => s.key === 'profitability')!.score, 70);
  const empty = computeHealthScore(healthInput());
  assert.equal(empty.subs.find((s) => s.key === 'profitability')!.score, null);
});

test('total averages available subscores; empty business scores pipeline 0 + cash 100', () => {
  const h = computeHealthScore(healthInput());
  // cashFlow=100 (no receivables), pipeline=0, operations=null, profitability=null
  assert.equal(h.total, 50);
});
