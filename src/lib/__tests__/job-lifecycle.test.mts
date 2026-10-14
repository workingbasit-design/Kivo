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
import { isJobLate, jobStatusLabel, JOB_STATUSES } from '../job-status.ts';

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

test('isJobLate: finished/cancelled/in-progress jobs are never late', () => {
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
