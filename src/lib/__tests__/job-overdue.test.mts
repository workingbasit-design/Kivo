/**
 * Unit tests for overdue job display (2026-09-26: users reported that jobs
 * whose date passed never changed status).
 * Pure helpers: src/lib/utils.ts → isJobOverdue / jobDisplayStatus.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/job-overdue.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isJobOverdue, jobDisplayStatus, statusClasses } from '../utils.ts';

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const now = new Date('2026-09-26T12:00:00');
const yesterday = new Date('2026-09-25T10:00:00');
const today = new Date('2026-09-26T09:00:00');
const tomorrow = new Date('2026-09-27T10:00:00');

test('isJobOverdue: unstarted job with past date is overdue; in-progress never (standing rule 2026-10-17)', () => {
  assert.equal(isJobOverdue('SCHEDULED', yesterday, now), true);
  assert.equal(isJobOverdue('NEW', yesterday, now), true);
  assert.equal(isJobOverdue('IN PROGRESS', yesterday, now), false);
});

test('isJobOverdue: job due today or in the future is not overdue', () => {
  assert.equal(isJobOverdue('SCHEDULED', today, now), false);
  assert.equal(isJobOverdue('SCHEDULED', tomorrow, now), false);
});

test('isJobOverdue: finished/cancelled jobs are never overdue', () => {
  for (const s of ['COMPLETED', 'PAID', 'CANCELLED']) {
    assert.equal(isJobOverdue(s, yesterday, now), false, s);
  }
});

test('isJobOverdue: null, missing and garbage dates are not overdue', () => {
  assert.equal(isJobOverdue('SCHEDULED', null, now), false);
  assert.equal(isJobOverdue('SCHEDULED', undefined, now), false);
  assert.equal(isJobOverdue('SCHEDULED', 'not-a-date', now), false);
});

test('isJobOverdue: accepts YYYY-MM-DD strings as local calendar days', () => {
  assert.equal(isJobOverdue('SCHEDULED', fmt(yesterday), now), true);
  assert.equal(isJobOverdue('SCHEDULED', fmt(today), now), false);
});

test('jobDisplayStatus: returns LATE label only when overdue', () => {
  assert.equal(jobDisplayStatus('SCHEDULED', yesterday, now), 'LATE');
  assert.equal(jobDisplayStatus('SCHEDULED', today, now), 'SCHEDULED');
  assert.equal(jobDisplayStatus('COMPLETED', yesterday, now), 'COMPLETED');
  assert.equal(jobDisplayStatus('CANCELLED', yesterday, now), 'CANCELLED');
});

test('statusClasses: LATE gets an urgent red badge', () => {
  const cls = statusClasses('LATE');
  assert.ok(cls.includes('danger'), `expected danger classes, got: ${cls}`);
});
