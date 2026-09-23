/**
 * Regression tests for the business-timezone day boundary used by public
 * booking validation (src/app/actions/booking-slots.ts).
 *
 * The server runs on UTC. A same-day evening booking in Toronto (EDT, UTC-4)
 * must NOT be rejected as "in the past" just because UTC has already rolled
 * past midnight. These tests pin the day-boundary behavior that the
 * booking past-date check relies on: the calendar day is always computed in
 * the business's timezone.
 *
 * Run: node --test src/lib/__tests__/booking-timezone.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { toISODateInTimezone } from '../utils.ts';

// 2026-09-23T02:30:00Z — it is already Sep 23 in UTC, but still Sep 22
// (10:30 PM EDT) in Toronto.
const TORONTO_EVENING = new Date('2026-09-23T02:30:00.000Z');

test('Toronto calendar day differs from UTC day late at night', () => {
  assert.equal(toISODateInTimezone(TORONTO_EVENING, 'America/Toronto'), '2026-09-22');
  assert.equal(toISODateInTimezone(TORONTO_EVENING, 'UTC'), '2026-09-23');
});

test('booking date check: same Toronto calendar day is not in the past', () => {
  const todayStr = toISODateInTimezone(TORONTO_EVENING, 'America/Toronto');
  const bookingDate = '2026-09-22'; // customer picks "today" in Toronto
  assert.ok(!(bookingDate < todayStr), 'same-day booking must be accepted');
});

test('booking date check: a truly past day is rejected', () => {
  const todayStr = toISODateInTimezone(TORONTO_EVENING, 'America/Toronto');
  assert.ok('2026-09-21' < todayStr, 'yesterday must be rejected');
  assert.ok(!('2026-09-23' < todayStr), 'tomorrow must be accepted');
});

test('Vancouver (PDT) boundary agrees with its own timezone', () => {
  // 2026-09-23T06:30:00Z = Sep 22, 11:30 PM PDT in Vancouver.
  const d = new Date('2026-09-23T06:30:00.000Z');
  assert.equal(toISODateInTimezone(d, 'America/Vancouver'), '2026-09-22');
});
