/**
 * Unit tests for "booked today" aggregation (2026-09-24 defect: cancelling a
 * job left its amount in the sidebar/dashboard "booked today" total).
 * Pure helper: src/lib/dashboard.ts → summarizeTodayJobs.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/dashboard.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeTodayJobs } from '../dashboard.ts';

test('summarizeTodayJobs excludes CANCELLED jobs from booked revenue', () => {
  const { bookedToday, jobsLeftToday } = summarizeTodayJobs([
    { status: 'SCHEDULED', price: 250 },
    { status: 'CANCELLED', price: 500 },
  ]);
  assert.equal(bookedToday, 250);
  assert.equal(jobsLeftToday, 1);
});

test('summarizeTodayJobs counts only open statuses as jobs left', () => {
  const { bookedToday, jobsLeftToday } = summarizeTodayJobs([
    { status: 'NEW', price: 100 },
    { status: 'SCHEDULED', price: 99.99 }, // cents supported
    { status: 'IN PROGRESS', price: 0 },
    { status: 'COMPLETED', price: 300 },
    { status: 'PAID', price: 400 },
    { status: 'CANCELLED', price: 700 },
  ]);
  assert.equal(bookedToday, 100 + 99.99 + 300 + 400);
  assert.equal(jobsLeftToday, 3);
});

test('summarizeTodayJobs treats null price as 0 and empty list as 0/0', () => {
  assert.deepEqual(summarizeTodayJobs([{ status: 'SCHEDULED', price: null }]), {
    bookedToday: 0,
    jobsLeftToday: 1,
  });
  assert.deepEqual(summarizeTodayJobs([]), { bookedToday: 0, jobsLeftToday: 0 });
});
