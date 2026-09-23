/**
 * Unit tests for the safe workflow engine + recurring helpers (Track 8).
 * Pure trigger evaluation is tested directly; the engine run is tested
 * against the Prisma stub (no database) including the idempotency
 * guarantee: a second run never fires twice for the same entity.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/workflows.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Redirect @/lib/prisma to the in-memory stub BEFORE importing modules
// under test. Dynamic import: static imports hoist above register().
register('./prisma-stub-loader.mjs', import.meta.url);

const workflows = await import('@/lib/workflows.ts');
const recurring = await import('@/lib/recurring.ts');
const stub = await import('./prisma-stub.mjs');

const {
  jobsCompletedDue,
  quotesAwaitingDue,
  invoicesOverdueDue,
  runWorkflowsForBusiness,
  WORKFLOW_TRIGGERS,
} = workflows;
const { occurrenceDayWindow, advanceNextRun } = recurring;
const { setFixture, clearFixtures, writeCalls, resetWriteCalls } = stub;

/* ------------------------------------------------------------------ */
/* Pure trigger evaluation                                             */
/* ------------------------------------------------------------------ */

const NOW = new Date('2026-09-23T12:00:00.000Z');
const hAgo = (h: number) => new Date(NOW.getTime() - h * 3600 * 1000);
const dAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 3600 * 1000);

test('WORKFLOW_TRIGGERS lists the three safe triggers', () => {
  assert.deepEqual([...WORKFLOW_TRIGGERS], ['JOB_COMPLETED', 'QUOTE_AWAITING', 'INVOICE_OVERDUE']);
});

test('jobsCompletedDue fires for jobs completed inside the window only', () => {
  const ids = jobsCompletedDue(
    [
      { id: 'j1', updatedAt: hAgo(1) },
      { id: 'j2', updatedAt: hAgo(47) },
      { id: 'j3', updatedAt: hAgo(49) }, // outside the 48h window
    ],
    NOW
  );
  assert.deepEqual(ids, ['j1', 'j2']);
});

test('quotesAwaitingDue fires for SENT quotes idle past followUpDays', () => {
  const ids = quotesAwaitingDue(
    [
      { id: 'q1', updatedAt: dAgo(5) },
      { id: 'q2', updatedAt: dAgo(3) }, // exactly at the boundary (<= cutoff)
      { id: 'q3', updatedAt: dAgo(1) },
    ],
    NOW,
    3
  );
  assert.deepEqual(ids, ['q1', 'q2']);
});

test('invoicesOverdueDue fires for unpaid invoices past the grace period', () => {
  const ids = invoicesOverdueDue(
    [
      { id: 'i1', date: dAgo(30), status: 'UNPAID' },
      { id: 'i2', date: dAgo(20), status: 'PARTIALLY PAID' },
      { id: 'i3', date: dAgo(30), status: 'PAID' }, // paid → never fires
      { id: 'i4', date: dAgo(5), status: 'UNPAID' }, // within grace
    ],
    NOW,
    14
  );
  assert.deepEqual(ids, ['i1', 'i2']);
});

/* ------------------------------------------------------------------ */
/* Recurring helpers                                                   */
/* ------------------------------------------------------------------ */

test('occurrenceDayWindow buckets an occurrence in the business timezone', () => {
  // 2026-09-23T03:00:00Z is still Sep 22 in Toronto (EDT).
  const { gte, lt } = occurrenceDayWindow(new Date('2026-09-23T03:00:00.000Z'), 'America/Toronto');
  assert.equal(gte.getFullYear(), 2026);
  assert.equal(gte.getMonth(), 8);
  assert.equal(gte.getDate(), 22);
  assert.equal(gte.getHours(), 0);
  assert.equal(lt.getTime() - gte.getTime(), 24 * 3600 * 1000);
});

test('advanceNextRun steps weekly, biweekly and monthly', () => {
  const base = new Date('2026-09-23T12:00:00Z');
  assert.equal(advanceNextRun(base, 'WEEKLY').getTime(), new Date('2026-09-30T12:00:00Z').getTime());
  assert.equal(advanceNextRun(base, 'BIWEEKLY').getTime(), new Date('2026-10-07T12:00:00Z').getTime());
  const m = advanceNextRun(base, 'MONTHLY');
  assert.equal(m.getUTCMonth(), 9);
  assert.equal(m.getUTCDate(), 23);
});

/* ------------------------------------------------------------------ */
/* Engine run against the stub (idempotency)                           */
/* ------------------------------------------------------------------ */

function jobRule() {
  return {
    id: 'rule-job-1',
    businessId: 'biz-1',
    name: 'Job completed',
    trigger: 'JOB_COMPLETED',
    enabled: true,
    configJson: JSON.stringify({ reviewDraft: true }),
  };
}

function completedJob() {
  return {
    id: 'job-1',
    title: 'Furnace repair',
    updatedAt: new Date(Date.now() - 3600 * 1000), // 1h ago
    customer: { name: 'Sarah Miller' },
  };
}

test('runWorkflowsForBusiness fires a review-request draft once, then never again', async () => {
  clearFixtures();
  resetWriteCalls();
  setFixture('workflowRule', 'findMany', [jobRule()]);
  setFixture('workflowEvent', 'findMany', []);
  setFixture('job', 'findMany', [completedJob()]);

  const first = await runWorkflowsForBusiness('biz-1');
  assert.equal(first.rulesEvaluated, 1);
  assert.equal(first.fired, 1);

  const eventWrites = writeCalls.filter((w) => w.model === 'workflowEvent' && w.method === 'create');
  const notifWrites = writeCalls.filter((w) => w.model === 'notification' && w.method === 'create');
  assert.equal(eventWrites.length, 1);
  assert.equal(notifWrites.length, 1);
  // In-app notification only: type + draft content, no send.
  assert.equal(notifWrites[0].args.data.type, 'review_request_draft');
  const data = JSON.parse(notifWrites[0].args.data.data);
  assert.ok(data.draftEn.includes('Sarah Miller'));
  assert.ok(data.draftFr.length > 0);
  // Automation log records the run.
  const logWrites = writeCalls.filter((w) => w.model === 'automationLog' && w.method === 'create');
  assert.equal(logWrites.length, 1);
  assert.equal(logWrites[0].args.data.kind, 'WORKFLOW');

  // Second run: the WorkflowEvent marker now exists → nothing fires again.
  resetWriteCalls();
  setFixture('workflowEvent', 'findMany', [
    { ruleId: 'rule-job-1', entityType: 'JOB', entityId: 'job-1' },
  ]);
  const second = await runWorkflowsForBusiness('biz-1');
  assert.equal(second.fired, 0);
  assert.equal(
    writeCalls.filter((w) => w.model === 'notification' && w.method === 'create').length,
    0
  );
});

test('runWorkflowsForBusiness skips disabled rules and respects reviewDraft=false', async () => {
  clearFixtures();
  resetWriteCalls();
  setFixture('workflowRule', 'findMany', [
    { ...jobRule(), id: 'rule-off', enabled: false },
    { ...jobRule(), id: 'rule-no-draft', configJson: JSON.stringify({ reviewDraft: false }) },
  ]);
  setFixture('workflowEvent', 'findMany', []);
  setFixture('job', 'findMany', [completedJob()]);

  const r = await runWorkflowsForBusiness('biz-1');
  assert.equal(r.rulesEvaluated, 1); // disabled rule not evaluated
  assert.equal(r.fired, 1);
  const notifWrites = writeCalls.filter((w) => w.model === 'notification' && w.method === 'create');
  assert.equal(notifWrites.length, 1);
  const data = JSON.parse(notifWrites[0].args.data.data);
  assert.equal(data.draftEn, '');
  assert.equal(data.draftFr, '');
});

test('runWorkflowsForBusiness fires quote follow-ups and invoice overdue reminders', async () => {
  clearFixtures();
  resetWriteCalls();
  const old = new Date(Date.now() - 10 * 24 * 3600 * 1000); // 10 days ago
  setFixture('workflowRule', 'findMany', [
    {
      id: 'rule-quote-1',
      businessId: 'biz-1',
      name: 'Quote awaiting',
      trigger: 'QUOTE_AWAITING',
      enabled: true,
      configJson: JSON.stringify({ followUpDays: 3 }),
    },
    {
      id: 'rule-inv-1',
      businessId: 'biz-1',
      name: 'Invoice overdue',
      trigger: 'INVOICE_OVERDUE',
      enabled: true,
      configJson: JSON.stringify({ graceDays: 14 }),
    },
  ]);
  setFixture('workflowEvent', 'findMany', []);
  setFixture('quote', 'findMany', [
    { id: 'q1', number: 'Q-1001', title: 'Deck build', total: 2500, updatedAt: old, customer: { name: 'Tom Lee' } },
  ]);
  setFixture('invoice', 'findMany', [
    { id: 'i1', number: 'INV-501', total: 800, date: new Date(Date.now() - 30 * 24 * 3600 * 1000), status: 'UNPAID', customer: { name: 'Tom Lee' } },
  ]);

  const r = await runWorkflowsForBusiness('biz-1');
  assert.equal(r.fired, 2);
  const types = writeCalls
    .filter((w) => w.model === 'notification' && w.method === 'create')
    .map((w) => w.args.data.type)
    .sort();
  assert.deepEqual(types, ['workflow_invoice_overdue', 'workflow_quote_followup']);
});
