/**
 * Unit tests for the canonical job lifecycle (Part A1).
 * Pure helpers: src/lib/job-status.ts -> isJobLate / jobStatusLabel.
 *
 * Covers: timezone-aware Late derivation in three Canadian zones, the
 * DST fallback on Sunday Nov 1 2026, the evening edge where UTC has
 * already rolled to the next day, and status eligibility.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/job-lifecycle.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isJobLate,
  isRunningOver,
  jobStatusLabel,
  JOB_STATUSES,
  deriveJobWindow,
  storedTimeMinutes,
  DEFAULT_JOB_DURATION_MINUTES,
} from '../job-status.ts';

const D = (iso: string) => new Date(iso);

test('JOB_STATUSES is the single fixed filter order', () => {
  assert.deepEqual([...JOB_STATUSES], [
    'NEW',
    'SCHEDULED',
    'IN PROGRESS',
    'COMPLETED',
    'PAID',
    'CANCELLED',
  ]);
});

test('jobStatusLabel: sentence case in en and fr', () => {
  assert.equal(jobStatusLabel('NEW', 'en'), 'New');
  assert.equal(jobStatusLabel('SCHEDULED', 'en'), 'Scheduled');
  assert.equal(jobStatusLabel('IN PROGRESS', 'en'), 'In progress');
  assert.equal(jobStatusLabel('COMPLETED', 'en'), 'Completed');
  assert.equal(jobStatusLabel('CANCELLED', 'en'), 'Cancelled');
  assert.equal(jobStatusLabel('NEW', 'fr'), 'Nouveau');
  assert.equal(jobStatusLabel('SCHEDULED', 'fr'), 'Planifié');
  assert.equal(jobStatusLabel('IN PROGRESS', 'fr'), 'En cours');
  assert.equal(jobStatusLabel('COMPLETED', 'fr'), 'Terminé');
  assert.equal(jobStatusLabel('CANCELLED', 'fr'), 'Annulé');
});

test('isJobLate: past date + open status is late (America/Toronto)', () => {
  const now = D('2026-10-13T12:00:00Z'); // 08:00 Toronto
  assert.equal(isJobLate({ date: D('2026-10-12T16:00:00Z'), status: 'SCHEDULED' }, now, 'America/Toronto'), true);
  assert.equal(isJobLate({ date: D('2026-10-12T16:00:00Z'), status: 'NEW' }, now, 'America/Toronto'), true);
});

test('isJobLate: job due today is not late (America/Toronto)', () => {
  const now = D('2026-10-13T12:00:00Z');
  assert.equal(isJobLate({ date: D('2026-10-13T16:00:00Z'), status: 'SCHEDULED' }, now, 'America/Toronto'), false);
});

test('isJobLate: evening edge - 9 PM Toronto is still Oct 13, not Oct 14', () => {
  // 21:00 Toronto (EDT, UTC-4) on Oct 13 = 01:00 UTC on Oct 14.
  // The old server-UTC logic flipped this job Late; timezone-aware logic must not.
  const now = D('2026-10-14T01:00:00Z');
  const job = { date: D('2026-10-13T16:00:00Z'), status: 'SCHEDULED' }; // noon Toronto Oct 13
  assert.equal(isJobLate(job, now, 'America/Toronto'), false);
  // …but the next morning it IS late.
  assert.equal(isJobLate(job, D('2026-10-14T14:00:00Z'), 'America/Toronto'), true);
});

test('isJobLate: America/Regina (no DST) - same calendar rules', () => {
  // Regina is CST year-round (UTC-6). 20:00 Regina Oct 13 = 02:00 UTC Oct 14.
  const now = D('2026-10-14T02:00:00Z');
  const job = { date: D('2026-10-13T16:00:00Z'), status: 'NEW' };
  assert.equal(isJobLate(job, now, 'America/Regina'), false);
  assert.equal(isJobLate(job, D('2026-10-14T14:00:00Z'), 'America/Regina'), true);
});

test('isJobLate: America/St_Johns (half-hour offset) - evening edge', () => {
  // 21:00 St_Johns (NDT, UTC-2:30) on Oct 13 = 23:30 UTC on Oct 13.
  const now = D('2026-10-13T23:30:00Z');
  const job = { date: D('2026-10-13T16:00:00Z'), status: 'SCHEDULED' };
  assert.equal(isJobLate(job, now, 'America/St_Johns'), false);
  // 21:00 St_Johns Oct 14 = 23:30 UTC Oct 14 - job Oct 13 is late by then.
  assert.equal(isJobLate(job, D('2026-10-14T23:30:00Z'), 'America/St_Johns'), true);
});

test('isJobLate: DST fallback Sunday Nov 1 2026 (America/Toronto)', () => {
  // At 02:00 EDT clocks fall back to 01:00 EST - the 01:00-02:00 hour
  // repeats. A job dated Nov 1 must stay "today" through both passes.
  const firstPass = D('2026-11-01T05:30:00Z'); // 01:30 EDT (first)
  const secondPass = D('2026-11-01T06:30:00Z'); // 01:30 EST (second)
  const job = { date: D('2026-11-01T16:00:00Z'), status: 'SCHEDULED' };
  assert.equal(isJobLate(job, firstPass, 'America/Toronto'), false);
  assert.equal(isJobLate(job, secondPass, 'America/Toronto'), false);
  // Nov 2: late.
  assert.equal(isJobLate(job, D('2026-11-02T14:00:00Z'), 'America/Toronto'), true);
});

test('isJobLate: DST fallback Sunday Nov 1 2026 (America/St_Johns)', () => {
  // St_Johns also falls back (02:00 NDT -> 01:00 NST).
  const job = { date: D('2026-11-01T16:00:00Z'), status: 'NEW' };
  assert.equal(isJobLate(job, D('2026-11-01T05:00:00Z'), 'America/St_Johns'), false);
  assert.equal(isJobLate(job, D('2026-11-02T14:00:00Z'), 'America/St_Johns'), true);
});

test('isJobLate: finished/cancelled/in-progress jobs are never late (standing owner rule 2026-10-17)', () => {
  const now = D('2026-10-13T12:00:00Z');
  const past = D('2026-10-10T16:00:00Z');
  for (const s of ['COMPLETED', 'PAID', 'CANCELLED', 'IN PROGRESS']) {
    assert.equal(isJobLate({ date: past, status: s }, now, 'America/Toronto'), false, s);
  }
});

test('isJobLate: future dates and missing dates are not late', () => {
  const now = D('2026-10-13T12:00:00Z');
  assert.equal(isJobLate({ date: D('2026-10-20T16:00:00Z'), status: 'SCHEDULED' }, now, 'America/Toronto'), false);
  assert.equal(isJobLate({ date: null, status: 'SCHEDULED' }, now, 'America/Toronto'), false);
  assert.equal(isJobLate({ date: undefined, status: 'SCHEDULED' }, now, 'America/Toronto'), false);
});

test('isJobLate: YYYY-MM-DD string dates work as calendar days', () => {
  const now = D('2026-10-13T12:00:00Z');
  assert.equal(isJobLate({ date: '2026-10-12', status: 'SCHEDULED' }, now, 'America/Toronto'), true);
  assert.equal(isJobLate({ date: '2026-10-13', status: 'SCHEDULED' }, now, 'America/Toronto'), false);
});

test('isJobLate: startAt precision - a today job whose start time passed is late', () => {
  // 2026-10-13 14:00 UTC = 10:00 Toronto. A 9:00 a.m. Toronto start that has
  // not begun is Late, even though its calendar day is today.
  const now = D('2026-10-13T14:00:00Z');
  assert.equal(
    isJobLate({ date: '2026-10-13', startAt: D('2026-10-13T13:00:00Z'), status: 'SCHEDULED' }, now, 'America/Toronto'),
    true,
  );
  // …but a 3:00 p.m. start later today is not.
  assert.equal(
    isJobLate({ date: '2026-10-13', startAt: D('2026-10-13T19:00:00Z'), status: 'SCHEDULED' }, now, 'America/Toronto'),
    false,
  );
});

test('isJobLate: startAt wins over the calendar-day fallback', () => {
  // startAt tomorrow, date yesterday (stale legacy date): not late, because
  // the canonical start has not passed.
  const now = D('2026-10-13T14:00:00Z');
  assert.equal(
    isJobLate({ date: '2026-10-12', startAt: D('2026-10-14T13:00:00Z'), status: 'NEW' }, now, 'America/Toronto'),
    false,
  );
  // Invalid startAt falls back to the calendar-day rule.
  assert.equal(
    isJobLate({ date: '2026-10-12', startAt: 'not-a-date', status: 'NEW' }, now, 'America/Toronto'),
    true,
  );
});

test('isRunningOver: IN PROGRESS past its end time', () => {
  const now = D('2026-10-13T18:00:00Z'); // 14:00 Toronto
  assert.equal(
    isRunningOver({ status: 'IN PROGRESS', endAt: D('2026-10-13T17:00:00Z') }, now),
    true,
  );
  // End time in the future: not running over.
  assert.equal(
    isRunningOver({ status: 'IN PROGRESS', endAt: D('2026-10-13T20:00:00Z') }, now),
    false,
  );
  // No end time: cannot run over.
  assert.equal(isRunningOver({ status: 'IN PROGRESS', endAt: null }, now), false);
  assert.equal(isRunningOver({ status: 'IN PROGRESS' }, now), false);
  // Not in progress: never running over, even past the end time.
  assert.equal(
    isRunningOver({ status: 'SCHEDULED', endAt: D('2026-10-13T17:00:00Z') }, now),
    false,
  );
  assert.equal(
    isRunningOver({ status: 'COMPLETED', endAt: D('2026-10-13T17:00:00Z') }, now),
    false,
  );
});

/* ------------------------------------------------------------------ */
/* D2 (2026-10-21): "Running over" must be reachable for jobs whose    */
/* canonical startAt/endAt were never written. The window derives from */
/* the stored date + time exactly the way the create/edit actions now  */
/* persist it (deriveJobWindow), so old and new rows behave alike.     */
/* ------------------------------------------------------------------ */

test('storedTimeMinutes: canonical HH:MM only', () => {
  assert.equal(storedTimeMinutes('08:00'), 480);
  assert.equal(storedTimeMinutes('13:30'), 810);
  assert.equal(storedTimeMinutes('00:00'), 0);
  assert.equal(storedTimeMinutes('TBD'), null);
  assert.equal(storedTimeMinutes('8am'), null);
  assert.equal(storedTimeMinutes('25:00'), null);
  assert.equal(storedTimeMinutes(''), null);
  assert.equal(storedTimeMinutes(null), null);
  assert.equal(storedTimeMinutes(undefined), null);
});

test('deriveJobWindow: stored startAt/endAt win over derivation', () => {
  const w = deriveJobWindow({
    date: D('2026-10-21T04:00:00Z'),
    time: '08:00',
    startAt: D('2026-10-21T14:00:00Z'),
    endAt: D('2026-10-21T16:30:00Z'),
  });
  assert.equal(w.startAt?.toISOString(), '2026-10-21T14:00:00.000Z');
  assert.equal(w.endAt?.toISOString(), '2026-10-21T16:30:00.000Z');
});

test('deriveJobWindow: derives start from date + time, end = start + standard length', () => {
  // 2026-10-21T04:00:00Z is midnight in America/Toronto (EDT).
  const w = deriveJobWindow({ date: D('2026-10-21T04:00:00Z'), time: '08:00' });
  assert.equal(w.startAt?.toISOString(), '2026-10-21T12:00:00.000Z');
  assert.equal(
    w.endAt?.getTime(),
    w.startAt!.getTime() + DEFAULT_JOB_DURATION_MINUTES * 60_000,
  );
});

test('deriveJobWindow: honours an explicit duration (price-book service length)', () => {
  const w = deriveJobWindow({ date: D('2026-10-21T04:00:00Z'), time: '08:00' }, 120);
  assert.equal(w.endAt?.toISOString(), '2026-10-21T14:00:00.000Z');
});

test('deriveJobWindow: no usable time → no window (nothing to run over)', () => {
  assert.deepEqual(deriveJobWindow({ date: D('2026-10-21T04:00:00Z'), time: null }), {
    startAt: null,
    endAt: null,
  });
  assert.deepEqual(deriveJobWindow({ date: D('2026-10-21T04:00:00Z'), time: 'TBD' }), {
    startAt: null,
    endAt: null,
  });
  assert.deepEqual(deriveJobWindow({}), { startAt: null, endAt: null });
});

test('isRunningOver (D2): QA scenario — 8:00 AM job still in progress at 11:05 AM', () => {
  const job = {
    status: 'IN PROGRESS',
    date: D('2026-10-21T04:00:00Z'), // midnight Toronto
    time: '08:00',
    startAt: null,
    endAt: null,
  };
  // 15:05Z = 11:05 EDT — over three hours after the 8 AM start.
  assert.equal(isRunningOver(job, D('2026-10-21T15:05:00Z')), true);
  // 12:30Z = 8:30 EDT — inside the standard one-hour window.
  assert.equal(isRunningOver(job, D('2026-10-21T12:30:00Z')), false);
  // Exactly at the derived end (13:00Z): not yet over.
  assert.equal(isRunningOver(job, D('2026-10-21T13:00:00Z')), false);
});

test('isRunningOver (D2): derives the end from a stored startAt alone', () => {
  const job = { status: 'IN PROGRESS', startAt: D('2026-10-21T12:00:00Z'), endAt: null };
  assert.equal(isRunningOver(job, D('2026-10-21T12:59:00Z')), false);
  assert.equal(isRunningOver(job, D('2026-10-21T13:01:00Z')), true);
});

test('isRunningOver (D2): untimed in-progress job can never run over', () => {
  const job = { status: 'IN PROGRESS', date: D('2026-10-20T04:00:00Z'), time: null };
  assert.equal(isRunningOver(job, D('2026-10-21T15:05:00Z')), false);
});
