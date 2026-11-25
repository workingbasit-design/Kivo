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
import { parseDateInputInTimezone, toISODateInTimezone } from '../utils.ts';
import { deriveJobWindow } from '../job-status.ts';

// 2026-09-23T02:30:00Z - it is already Sep 23 in UTC, but still Sep 22
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

// --- Stored-date regression (2026-11-25 deep test, end-user) -----------------
// A customer booked Thu Nov 26, 2026 at 10:00 AM via /book/<slug>. The job
// detail header read "Today, 10:00 AM - 6:00 a.m. / Wednesday, November 25"
// and the /jobs list grouped it under Today. Root cause: runBookingWithTime
// stored `new Date(date + 'T00:00:00')` — midnight SERVER-local (UTC on
// Vercel) — instead of midnight in the business timezone, violating the
// deriveJobWindow contract that `date` is the start of the scheduled day in
// the business timezone. The fix parses with parseDateInputInTimezone.
const TZ = 'America/Toronto';

test('booking stored date: Nov 26 request reads back as Nov 26 in Toronto', () => {
  const stored = parseDateInputInTimezone('2026-11-26', TZ);
  assert.equal(stored.toISOString(), '2026-11-26T05:00:00.000Z'); // EST, UTC-5
  assert.equal(toISODateInTimezone(stored, TZ), '2026-11-26');
});

test('booking stored date: old UTC-midnight parse read back as Nov 25 in Toronto', () => {
  // What `new Date('2026-11-26T00:00:00')` yields on the UTC server.
  const buggy = new Date(Date.UTC(2026, 10, 26));
  assert.equal(toISODateInTimezone(buggy, TZ), '2026-11-25');
});

test('booking window: fixed stored date derives 10:00-11:00 AM Toronto', () => {
  const stored = parseDateInputInTimezone('2026-11-26', TZ);
  const win = deriveJobWindow({ date: stored, time: '10:00' });
  assert.equal(win.startAt?.toISOString(), '2026-11-26T15:00:00.000Z');
  assert.equal(win.endAt?.toISOString(), '2026-11-26T16:00:00.000Z');
  assert.equal(toISODateInTimezone(win.startAt!, TZ), '2026-11-26');
  assert.equal(toISODateInTimezone(win.endAt!, TZ), '2026-11-26');
});

test('booking window: old stored date derived a 6:00 a.m. Toronto end', () => {
  const buggy = new Date(Date.UTC(2026, 10, 26));
  const win = deriveJobWindow({ date: buggy, time: '10:00' });
  // 11:00Z is 6:00 a.m. EST — the "10:00 AM - 6:00 a.m." header symptom.
  assert.equal(win.endAt?.toISOString(), '2026-11-26T11:00:00.000Z');
  assert.equal(toISODateInTimezone(win.endAt!, TZ), '2026-11-26');
  const hour = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, hour: 'numeric', hour12: false,
  }).format(win.endAt!);
  assert.equal(Number(hour), 6);
});
