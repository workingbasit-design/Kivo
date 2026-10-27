/**
 * Scroll lesson 1 — unit tests for the Continue candidate selector.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs
 *      src/lib/__tests__/continue-candidate.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectContinueCandidate,
  resolveContinueDisplay,
  type ContinueJobRow,
  type ContinueQuoteRow,
  type ContinueInvoiceRow,
} from '../continue-candidate.ts';

const TZ = 'America/Toronto';
// 2026-10-27 10:00 EDT.
const NOW = new Date('2026-10-27T14:00:00Z');
const TODAY_KEY = '2026-10-27';
const CTX = { todayKey: TODAY_KEY, timezone: TZ, now: NOW };

function job(
  over: Partial<ContinueJobRow> & { id: string }
): ContinueJobRow {
  return {
    title: 'Job',
    customerName: 'Alice',
    area: null,
    status: 'SCHEDULED',
    date: new Date('2026-10-27T04:00:00Z'),
    time: null,
    startAt: null,
    updatedAt: new Date('2026-10-26T12:00:00Z'),
    ...over,
  };
}

function quote(over: Partial<ContinueQuoteRow> & { id: string }): ContinueQuoteRow {
  return {
    title: 'Quote',
    customerName: 'Bob',
    updatedAt: new Date('2026-10-26T12:00:00Z'),
    ...over,
  };
}

function invoice(
  over: Partial<ContinueInvoiceRow> & { id: string }
): ContinueInvoiceRow {
  return {
    number: 'INV-0001',
    customerName: 'Carol',
    date: new Date('2026-10-01T04:00:00Z'),
    updatedAt: new Date('2026-10-26T12:00:00Z'),
    ...over,
  };
}

test('in-progress job beats today’s scheduled job', () => {
  const c = selectContinueCandidate(
    {
      jobs: [
        job({ id: 'today', time: '14:00' }),
        job({ id: 'doing', status: 'IN PROGRESS', updatedAt: new Date('2026-10-27T13:00:00Z') }),
      ],
      quotes: [],
      invoices: [],
    },
    CTX
  );
  assert.equal(c?.id, 'doing');
  assert.equal(c?.priority, 1);
  assert.equal(c?.action, 'continue');
  assert.equal(c?.meta.key, 'inProgress');
});

test('late job beats today’s job', () => {
  const c = selectContinueCandidate(
    {
      jobs: [
        job({ id: 'today', time: '14:00' }),
        job({ id: 'late', status: 'NEW', date: new Date('2026-10-26T04:00:00Z') }),
      ],
      quotes: [],
      invoices: [],
    },
    CTX
  );
  assert.equal(c?.id, 'late');
  assert.equal(c?.priority, 2);
  assert.equal(c?.meta.key, 'late');
});

test('today’s earliest visit wins, with its time carried for formatting', () => {
  const c = selectContinueCandidate(
    {
      jobs: [
        job({ id: 'later', time: '16:00' }),
        job({ id: 'earlier', time: '14:00' }),
      ],
      quotes: [],
      invoices: [],
    },
    CTX
  );
  assert.equal(c?.id, 'earlier');
  assert.equal(c?.priority, 3);
  assert.equal(c?.meta.key, 'todayAt');
  assert.equal(c?.meta.time, '14:00');
});

test('future job beats draft quote beats unpaid invoice', () => {
  const c = selectContinueCandidate(
    {
      jobs: [job({ id: 'future', date: new Date('2026-10-29T04:00:00Z') })],
      quotes: [quote({ id: 'draft' })],
      invoices: [invoice({ id: 'inv' })],
    },
    CTX
  );
  assert.equal(c?.id, 'future');
  assert.equal(c?.priority, 4);
  assert.equal(c?.meta.key, 'onDate');

  const c2 = selectContinueCandidate(
    { jobs: [], quotes: [quote({ id: 'draft' })], invoices: [invoice({ id: 'inv' })] },
    CTX
  );
  assert.equal(c2?.id, 'draft');
  assert.equal(c2?.priority, 5);
  assert.equal(c2?.action, 'send');

  const c3 = selectContinueCandidate(
    { jobs: [], quotes: [], invoices: [invoice({ id: 'inv' })] },
    CTX
  );
  assert.equal(c3?.id, 'inv');
  assert.equal(c3?.priority, 6);
  assert.equal(c3?.action, 'pay');
  assert.equal(c3?.title, 'INV-0001');
});

test('done, cancelled and paid jobs are never candidates', () => {
  const c = selectContinueCandidate(
    {
      jobs: [
        job({ id: 'done', status: 'COMPLETED' }),
        job({ id: 'paid', status: 'PAID' }),
        job({ id: 'cancelled', status: 'CANCELLED' }),
      ],
      quotes: [],
      invoices: [],
    },
    CTX
  );
  assert.equal(c, null);
});

test('empty input returns null', () => {
  assert.equal(
    selectContinueCandidate({ jobs: [], quotes: [], invoices: [] }, CTX),
    null
  );
});

const LABELS = {
  lastOpened: 'Where you left off',
  viewJob: 'View job',
  viewQuote: 'View quote',
  viewInvoice: 'View invoice',
};

const SERVER = {
  kind: 'job' as const,
  id: 'srv',
  title: 'Server job',
  subtitle: 'Alice',
  meta: 'Today at 2:00 p.m.',
  href: '/jobs/srv',
  actionLabel: 'View job',
};

test('resolveDisplay: urgent server candidate beats last-opened', () => {
  const out = resolveContinueDisplay(
    SERVER,
    2,
    { kind: 'quote', id: 'q1', title: 'Old quote', subtitle: 'Bob' },
    LABELS
  );
  assert.equal(out?.id, 'srv');
});

test('resolveDisplay: last-opened beats upcoming/admin server candidate', () => {
  const out = resolveContinueDisplay(
    SERVER,
    5,
    { kind: 'invoice', id: 'i1', title: 'INV-0009', subtitle: 'Carol' },
    LABELS
  );
  assert.equal(out?.id, 'i1');
  assert.equal(out?.meta, 'Where you left off');
  assert.equal(out?.actionLabel, 'View invoice');
  assert.equal(out?.href, '/invoices/i1');
});

test('resolveDisplay: same record on both sides keeps the server version', () => {
  const out = resolveContinueDisplay(
    SERVER,
    5,
    { kind: 'job', id: 'srv', title: 'Server job', subtitle: 'Alice' },
    LABELS
  );
  assert.equal(out?.meta, 'Today at 2:00 p.m.');
});

test('resolveDisplay: nulls fall through in order', () => {
  assert.equal(resolveContinueDisplay(null, null, null, LABELS), null);
  const out = resolveContinueDisplay(
    null,
    null,
    { kind: 'job', id: 'j1', title: 'Last job', subtitle: 'Alice' },
    LABELS
  );
  assert.equal(out?.id, 'j1');
  assert.equal(out?.href, '/jobs/j1');
});
