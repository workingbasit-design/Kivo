/**
 * Scroll lesson 2 — unit tests for the next-best-action selector.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs
 *      src/lib/__tests__/next-action.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectNextAction,
  type NextActionInput,
  type NextActionInvoiceRow,
  type NextActionJobRow,
  type NextActionCompletedRow,
} from '../next-action.ts';

// 2026-10-27 10:00 EDT.
const NOW = new Date('2026-10-27T14:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

function inv(over: Partial<NextActionInvoiceRow> & { id: string }): NextActionInvoiceRow {
  return {
    number: 'INV-0001',
    customerName: 'Alice',
    dueAt: null,
    date: daysAgo(10),
    ...over,
  };
}

function job(over: Partial<NextActionJobRow> & { id: string }): NextActionJobRow {
  return {
    title: 'Job',
    customerName: 'Alice',
    status: 'NEW',
    date: daysAgo(-1),
    time: '09:00',
    startAt: null,
    ...over,
  };
}

function done(over: Partial<NextActionCompletedRow> & { id: string }): NextActionCompletedRow {
  return {
    title: 'Done job',
    customerName: 'Alice',
    date: daysAgo(1),
    hasPaidInvoice: true,
    ...over,
  };
}

function input(over: Partial<NextActionInput> = {}): NextActionInput {
  return {
    invoices: [],
    tomorrowJobs: [],
    completedJobs: [],
    tomorrowHasAnyJob: false,
    ...over,
  };
}

test('empty world: fill-schedule when tomorrow is empty', () => {
  const out = selectNextAction(input(), { now: NOW });
  assert.equal(out?.kind, 'fill-schedule');
  assert.equal(out?.href, '/jobs/new');
});

test('no action when tomorrow has a job but nothing else fires', () => {
  const out = selectNextAction(
    input({
      tomorrowJobs: [job({ id: 'j1', status: 'IN PROGRESS' })],
      tomorrowHasAnyJob: true,
    }),
    { now: NOW }
  );
  assert.equal(out, null);
});

test('follow-up fires only past the 7-day boundary, oldest wins', () => {
  const seven = selectNextAction(input({ invoices: [inv({ id: 'i7', date: daysAgo(7) })], tomorrowHasAnyJob: true }), { now: NOW });
  assert.equal(seven, null);
  const eight = selectNextAction(input({ invoices: [inv({ id: 'i8', date: daysAgo(8) })] }), { now: NOW });
  assert.equal(eight?.kind, 'follow-up');
  assert.equal(eight?.meta.key, 'unpaidFor');
  const two = selectNextAction(
    input({
      invoices: [
        inv({ id: 'i8', date: daysAgo(8) }),
        inv({ id: 'i20', number: 'INV-0002', date: daysAgo(20) }),
      ],
    }),
    { now: NOW }
  );
  assert.equal(two?.title, 'INV-0002');
});

test('follow-up prefers dueAt over issue date for the overdue label', () => {
  const out = selectNextAction(
    input({
      invoices: [inv({ id: 'i1', date: daysAgo(40), dueAt: daysAgo(10) })],
    }),
    { now: NOW }
  );
  assert.equal(out?.kind, 'follow-up');
  assert.deepEqual(out?.meta, { key: 'overdue', days: 10 });
});

test('confirm picks tomorrow earliest job', () => {
  const out = selectNextAction(
    input({
      tomorrowJobs: [
        job({ id: 'late', time: '15:00' }),
        job({ id: 'early', time: '08:00', title: 'Early job' }),
      ],
      tomorrowHasAnyJob: true,
    }),
    { now: NOW }
  );
  assert.equal(out?.kind, 'confirm');
  assert.equal(out?.title, 'Early job');
  assert.equal(out?.href, '/jobs/early');
});

test('priority: follow-up beats confirm beats review beats fill', () => {
  const all = input({
    invoices: [inv({ id: 'i1' })],
    tomorrowJobs: [job({ id: 'j1' })],
    completedJobs: [done({ id: 'd1' })],
    tomorrowHasAnyJob: true,
  });
  assert.equal(selectNextAction(all, { now: NOW })?.kind, 'follow-up');
  const noInv = { ...all, invoices: [] };
  assert.equal(selectNextAction(noInv, { now: NOW })?.kind, 'confirm');
  const noTomorrow = { ...noInv, tomorrowJobs: [] };
  assert.equal(selectNextAction(noTomorrow, { now: NOW })?.kind, 'review');
  const noReview = { ...noTomorrow, completedJobs: [], tomorrowHasAnyJob: false };
  assert.equal(selectNextAction(noReview, { now: NOW })?.kind, 'fill-schedule');
});

test('review skips completed jobs without a paid invoice', () => {
  const out = selectNextAction(
    input({
      completedJobs: [
        done({ id: 'd1', hasPaidInvoice: false }),
        done({ id: 'd2', title: 'Paid job', hasPaidInvoice: true }),
      ],
      tomorrowHasAnyJob: true,
    }),
    { now: NOW }
  );
  assert.equal(out?.kind, 'review');
  assert.equal(out?.title, 'Paid job');
  const none = selectNextAction(
    input({
      completedJobs: [done({ id: 'd1', hasPaidInvoice: false })],
      tomorrowHasAnyJob: true,
    }),
    { now: NOW }
  );
  assert.equal(none, null);
});
