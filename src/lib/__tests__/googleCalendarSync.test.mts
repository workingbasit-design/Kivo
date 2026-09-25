/**
 * Unit tests for the Google Calendar sync pure helpers
 * (src/lib/googleCalendarSync.ts). No DB, no network, no Google.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/googleCalendarSync.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCOPE_CALENDAR_WRITE,
  EVERYJOB_JOB_ID_PROP,
  EVERYJOB_HASH_PROP,
  fingerprintJobEvent,
  jobToCalendarEvent,
} from '@/lib/googleCalendarSync.ts';

const parts = {
  summary: 'Faucet repair — Jane Doe',
  startISO: '2026-09-25T13:00:00.000Z',
  endISO: '2026-09-25T14:00:00.000Z',
  location: '123 Main St',
  description: 'EveryJob job · SCHEDULED',
};

test('fingerprintJobEvent is deterministic, compact, and field-sensitive', () => {
  const h1 = fingerprintJobEvent(parts);
  const h2 = fingerprintJobEvent(parts);
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{32}$/);
  assert.notEqual(fingerprintJobEvent({ ...parts, summary: 'Other — Jane Doe' }), h1);
  assert.notEqual(fingerprintJobEvent({ ...parts, startISO: '2026-09-25T15:00:00.000Z' }), h1);
});

test('jobToCalendarEvent builds a sane event body', () => {
  const job = {
    id: 'job1',
    title: 'Faucet repair',
    date: new Date(Date.UTC(2026, 8, 25)), // UTC-midnight calendar date, like the DB stores
    time: '09:30',
    address: '123 Main St, Toronto',
    price: 149.99,
    status: 'SCHEDULED',
    notes: 'Bring washers',
    technician: 'Sam',
    customer: { name: 'Jane Doe' },
  };
  const ev = jobToCalendarEvent(job, 'America/Toronto');
  assert.equal(ev.summary, 'Faucet repair — Jane Doe');
  assert.ok(ev.location.includes('Toronto'));
  assert.ok(ev.description.includes('Jane Doe'));
  assert.ok(ev.description.includes('$149.99'));
  assert.ok(ev.description.includes('Sam'));
  // Wall-clock time in the business zone — naive local ISO + IANA zone.
  assert.equal(ev.startISO, '2026-09-25T09:30:00');
  assert.equal(ev.endISO, '2026-09-25T10:30:00');
  assert.equal(ev.timeZone, 'America/Toronto');
});

test('jobToCalendarEvent rolls the end time past midnight', () => {
  const job = {
    id: 'job3',
    title: 'Late call',
    date: new Date(Date.UTC(2026, 8, 25)),
    time: '23:45',
    address: null,
    price: 100,
    status: 'SCHEDULED',
    notes: null,
    technician: null,
    customer: null,
  };
  const ev = jobToCalendarEvent(job, 'America/Toronto');
  assert.equal(ev.startISO, '2026-09-25T23:45:00');
  assert.equal(ev.endISO, '2026-09-26T00:45:00');
});

test('jobToCalendarEvent falls back gracefully on bad/missing time', () => {
  const job = {
    id: 'job2',
    title: 'Tune-up',
    date: new Date(Date.UTC(2026, 8, 26)),
    time: null,
    address: null,
    price: 0,
    status: 'SCHEDULED',
    notes: null,
    technician: null,
    customer: null,
  };
  const ev = jobToCalendarEvent(job, 'America/Toronto');
  assert.equal(ev.summary, 'Tune-up — Customer');
  assert.equal(ev.startISO, '2026-09-26T09:00:00', 'bad time falls back to 09:00 wall clock');
});

test('calendar constants are stable', () => {
  assert.equal(SCOPE_CALENDAR_WRITE, 'https://www.googleapis.com/auth/calendar');
  assert.equal(EVERYJOB_JOB_ID_PROP, 'everyjobJobId');
  assert.equal(EVERYJOB_HASH_PROP, 'everyjobHash');
});
