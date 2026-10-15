/**
 * P4-U-010…013 — Date/timezone edge cases for the Late badge.
 *
 * isJobOverdue compares calendar days in the BUSINESS timezone (the old
 * server-UTC bug flipped "today" jobs to LATE after ~8pm Toronto time).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isJobOverdue, toISODateInTimezone } from '../utils.ts';
import { isJobLate } from '../job-status.ts';

// 2026-10-14 23:30 Toronto (EDT, UTC-4) = 2026-10-15 03:30 UTC.
const TORONTO_LATE_NIGHT = new Date('2026-10-15T03:30:00Z');

test('P4-U-010: a job due "today" in Toronto is NOT late at 11:30pm local (UTC already tomorrow)', () => {
  assert.equal(isJobOverdue('SCHEDULED', '2026-10-14', TORONTO_LATE_NIGHT, 'America/Toronto'), false);
});

test('P4-U-010: a job due yesterday IS late, in every Canadian timezone', () => {
  for (const tz of [
    'America/Toronto',
    'America/Vancouver',
    'America/Regina',
    'America/St_Johns',
    'America/Edmonton',
    'America/Winnipeg',
    'America/Halifax',
  ]) {
    // Noon UTC on Oct 15; Oct 13 is "yesterday or earlier" in all zones.
    const noon = new Date('2026-10-15T12:00:00Z');
    assert.equal(isJobOverdue('SCHEDULED', '2026-10-13', noon, tz), true, tz);
    assert.equal(isJobOverdue('NEW', '2026-10-13', noon, tz), true, tz);
  }
});

test('P4-U-011: Regina (no DST, UTC-6) and St_Johns (+0:30) calendar days', () => {
  // 2026-10-15 04:00 UTC = Oct 14 22:00 Regina, Oct 15 01:30 St_Johns.
  const m = new Date('2026-10-15T04:00:00Z');
  assert.equal(toISODateInTimezone(m, 'America/Regina'), '2026-10-14');
  assert.equal(toISODateInTimezone(m, 'America/St_Johns'), '2026-10-15');
  // A job due Oct 14 is not late in Regina yet, but IS late in St_Johns.
  assert.equal(isJobOverdue('SCHEDULED', '2026-10-14', m, 'America/Regina'), false);
  assert.equal(isJobOverdue('SCHEDULED', '2026-10-14', m, 'America/St_Johns'), true);
});

test('P4-U-011: Vancouver (PDT, UTC-7) evening boundary', () => {
  // 2026-10-15 06:30 UTC = Oct 14 23:30 Vancouver.
  const m = new Date('2026-10-15T06:30:00Z');
  assert.equal(isJobOverdue('SCHEDULED', '2026-10-14', m, 'America/Vancouver'), false);
  assert.equal(isJobOverdue('SCHEDULED', '2026-10-13', m, 'America/Vancouver'), true);
});

test('P4-U-012: isJobOverdue — NEW/SCHEDULED/IN PROGRESS can be late; closed never', () => {
  const m = new Date('2026-10-15T12:00:00Z');
  for (const s of ['NEW', 'SCHEDULED', 'IN PROGRESS']) {
    assert.equal(isJobOverdue(s, '2026-10-01', m, 'America/Toronto'), true, s);
  }
  for (const s of ['COMPLETED', 'PAID', 'CANCELLED']) {
    assert.equal(isJobOverdue(s, '2026-10-01', m, 'America/Toronto'), false, s);
  }
  assert.equal(isJobOverdue('SCHEDULED', null, m), false);
  assert.equal(isJobOverdue('SCHEDULED', undefined, m), false);
});

test('P4-U-012: isJobLate (job-status.ts) — NEW/SCHEDULED only; documents the IN PROGRESS discrepancy', () => {
  // NOTE: isJobLate excludes IN PROGRESS while isJobOverdue includes it.
  // Logged as P2 in docs/BUGS.md (BUG-P4-001); do not "fix" the test without
  // a product decision — pin current behavior here.
  const m = new Date('2026-10-15T12:00:00Z');
  assert.equal(isJobLate({ date: '2026-10-01', status: 'NEW' }, m, 'America/Toronto'), true);
  assert.equal(isJobLate({ date: '2026-10-01', status: 'SCHEDULED' }, m, 'America/Toronto'), true);
  assert.equal(isJobLate({ date: '2026-10-01', status: 'IN PROGRESS' }, m, 'America/Toronto'), false);
});

test('P4-U-013: DST ends Sun 2026-11-01 — Toronto 25-hour day handled', () => {
  // 2026-11-01 05:30 UTC = 01:30 EDT; 2026-11-01 06:30 UTC = 01:30 EST (repeat hour).
  const before = new Date('2026-11-01T05:30:00Z');
  const after = new Date('2026-11-01T06:30:00Z');
  assert.equal(toISODateInTimezone(before, 'America/Toronto'), '2026-11-01');
  assert.equal(toISODateInTimezone(after, 'America/Toronto'), '2026-11-01');
  assert.equal(isJobOverdue('SCHEDULED', '2026-11-01', after, 'America/Toronto'), false);
  assert.equal(isJobOverdue('SCHEDULED', '2026-10-31', after, 'America/Toronto'), true);
});

test('P4-U-013: DST starts Sun 2027-03-14 — Toronto 23-hour day handled', () => {
  // 2027-03-14 07:30 UTC = 03:30 EDT (02:xx does not exist).
  const m = new Date('2027-03-14T07:30:00Z');
  assert.equal(toISODateInTimezone(m, 'America/Toronto'), '2027-03-14');
  assert.equal(isJobOverdue('SCHEDULED', '2027-03-14', m, 'America/Toronto'), false);
});
