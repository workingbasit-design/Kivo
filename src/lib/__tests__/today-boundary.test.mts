/**
 * Part A (dashboard rebuild): one definition of "today", in the business
 * timezone, everywhere.
 *
 * The reported bug: at 10:47 p.m. America/Toronto it is already the next
 * day in UTC. A server-local day window ("today" computed in UTC) would
 * show the wrong day's jobs in the evening, disagreeing with the attention
 * engine, which keys days in the business timezone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { todayInTimezone, dayRangeInTimezone } from '../utils.ts';

// 2026-10-17 22:47 America/Toronto (EDT, UTC-4) = 2026-10-18 02:47 UTC.
const LATE_EVENING_TORONTO = new Date('2026-10-17T22:47:00-04:00');

test('todayInTimezone: 10:47pm Toronto is still "today" Oct 17, not Oct 18', () => {
  assert.equal(
    todayInTimezone('America/Toronto', null, LATE_EVENING_TORONTO),
    '2026-10-17'
  );
});

test('todayInTimezone: the same instant is Oct 18 in UTC', () => {
  assert.equal(todayInTimezone('UTC', null, LATE_EVENING_TORONTO), '2026-10-18');
});

test('dayRangeInTimezone: Toronto Oct 17 spans 04:00Z Oct 17 to 03:59:59.999Z Oct 18', () => {
  const { gte, lte } = dayRangeInTimezone('2026-10-17', 'America/Toronto');
  assert.equal(gte.toISOString(), '2026-10-17T04:00:00.000Z');
  assert.equal(lte.toISOString(), '2026-10-18T03:59:59.999Z');
});

test('dayRangeInTimezone: a job at 10:47pm Toronto falls inside the Toronto day window', () => {
  const { gte, lte } = dayRangeInTimezone('2026-10-17', 'America/Toronto');
  assert.ok(
    LATE_EVENING_TORONTO.getTime() >= gte.getTime() &&
      LATE_EVENING_TORONTO.getTime() <= lte.getTime(),
    '10:47pm Toronto must be inside the Oct 17 business-day window'
  );
});

test('dayRangeInTimezone: winter (EST, UTC-5) anchors at 05:00Z', () => {
  const { gte, lte } = dayRangeInTimezone('2026-01-15', 'America/Toronto');
  assert.equal(gte.toISOString(), '2026-01-15T05:00:00.000Z');
  assert.equal(lte.toISOString(), '2026-01-16T04:59:59.999Z');
});

test('dayRangeInTimezone: Vancouver (PDT, UTC-7) anchors at 07:00Z', () => {
  const { gte, lte } = dayRangeInTimezone('2026-10-17', 'America/Vancouver');
  assert.equal(gte.toISOString(), '2026-10-17T07:00:00.000Z');
  assert.equal(lte.toISOString(), '2026-10-18T06:59:59.999Z');
});
