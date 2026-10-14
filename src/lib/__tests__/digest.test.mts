/**
 * Tests for the morning digest (src/lib/digest.ts).
 * Only the pure helpers are tested here - getDigestData hits the DB and is
 * covered by integration checks, not unit tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDigestPushBody, type DigestData } from '../digest.ts';

function baseDigest(over: Partial<DigestData> = {}): DigestData {
  return {
    businessId: 'biz1',
    businessName: 'Test Co',
    timezone: 'America/Toronto',
    dateKey: '2026-10-13',
    dayPart: 'morning',
    greeting: 'Test Co',
    todayJobs: [],
    tomorrowCount: 0,
    weekJobsCount: 0,
    weekScheduledRevenue: 0,
    actions: [],
    actionsTotal: 0,
    money: {
      overdueTotal: 0,
      overdueCount: 0,
      outstandingTotal: 0,
      outstandingCount: 0,
      paidThisWeek: 0,
      paidThisWeekCount: 0,
    },
    hasData: false,
    ...over,
  };
}

const fmt = (n: number) => `$${n.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`;

test('push body: quiet day shows only job count', () => {
  const d = baseDigest();
  assert.equal(buildDigestPushBody(d, fmt), '0 jobs today');
});

test('push body: single job uses singular', () => {
  const d = baseDigest({ todayJobs: [{ id: 'j1', title: 'Fix sink', time: '09:00', status: 'SCHEDULED', price: 150, customerName: 'Ann', address: null, technician: null, crewName: null }] });
  assert.equal(buildDigestPushBody(d, fmt), '1 job today');
});

test('push body: busy day lists jobs, actions and overdue', () => {
  const d = baseDigest({
    todayJobs: [
      { id: 'j1', title: 'A', time: '09:00', status: 'SCHEDULED', price: 150, customerName: 'Ann', address: null, technician: null, crewName: null },
      { id: 'j2', title: 'B', time: '11:00', status: 'SCHEDULED', price: 200, customerName: 'Bob', address: null, technician: null, crewName: null },
      { id: 'j3', title: 'C', time: '14:00', status: 'SCHEDULED', price: 300, customerName: 'Cat', address: null, technician: null, crewName: null },
    ],
    actionsTotal: 2,
    money: {
      overdueTotal: 1240, overdueCount: 2, outstandingTotal: 2000,
      outstandingCount: 3, paidThisWeek: 500, paidThisWeekCount: 1,
    },
  });
  assert.equal(
    buildDigestPushBody(d, fmt),
    '3 jobs today · 2 need action · $1,240 overdue'
  );
});

test('push body: single action uses singular', () => {
  const d = baseDigest({ actionsTotal: 1 });
  assert.equal(buildDigestPushBody(d, fmt), '0 jobs today · 1 needs action');
});

test('push body: no overdue omits the money part', () => {
  const d = baseDigest({ actionsTotal: 3 });
  assert.equal(buildDigestPushBody(d, fmt), '0 jobs today · 3 need action');
});
