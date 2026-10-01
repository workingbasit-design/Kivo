/**
 * Focused tests for the revenue-recovery features: overdue-invoice reminder
 * queue (Money hub) and quote follow-up queue (Quotes page).
 * Pure helpers in src/lib/revenue.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fillTemplate,
  daysOverdue,
  needsFollowUp,
  daysWaiting,
  remainingBalance,
  OVERDUE_AFTER_DAYS,
  FOLLOWUP_AFTER_DAYS,
  DAY_MS,
} from '../revenue.ts';

const at = (msAgo: number) => new Date(Date.now() - msAgo);

test('fillTemplate replaces every placeholder', () => {
  assert.equal(
    fillTemplate('Hi {name}, invoice {number} for {amount}.', {
      name: 'Aisha',
      number: 'INV-12',
      amount: '$150.00',
    }),
    'Hi Aisha, invoice INV-12 for $150.00.'
  );
});

test('fillTemplate replaces repeated placeholders', () => {
  assert.equal(fillTemplate('{x} and {x}', { x: '7' }), '7 and 7');
});

test('daysOverdue: 0 before Net-30, positive after, never negative', () => {
  // Explicit UTC so the assertions are deterministic regardless of when the
  // suite runs (the default business timezone is America/Toronto).
  assert.equal(daysOverdue(at(10 * DAY_MS), new Date(), 'UTC'), 0, '10 days old is not overdue');
  assert.equal(daysOverdue(at(OVERDUE_AFTER_DAYS * DAY_MS), new Date(), 'UTC'), 0, 'exactly 30 is not overdue');
  assert.equal(daysOverdue(at(45 * DAY_MS), new Date(), 'UTC'), 15, '45 days old is 15 days overdue');
  assert.equal(daysOverdue(new Date(Date.now() + DAY_MS), new Date(), 'UTC'), 0, 'future date never negative');
});

test('daysOverdue flips at local midnight in the business timezone', () => {
  const TZ = 'America/Toronto';
  // Invoice dated 2026-01-01 (stored as UTC midnight). Due date: 2026-01-31.
  const invoice = new Date(Date.UTC(2026, 0, 1));
  // 2026-01-31 23:30 Toronto = 2026-02-01 04:30 UTC — still the due date locally.
  assert.equal(daysOverdue(invoice, new Date(Date.UTC(2026, 1, 1, 4, 30)), TZ), 0);
  // 2026-02-01 00:30 Toronto = 2026-02-01 05:30 UTC — past the due date locally.
  assert.equal(daysOverdue(invoice, new Date(Date.UTC(2026, 1, 1, 5, 30)), TZ), 1);
  // Eight days after the due date.
  assert.equal(daysOverdue(invoice, new Date(Date.UTC(2026, 1, 8, 12, 0)), TZ), 8);
});

test('daysOverdue is immune to DST transitions (25-hour day)', () => {
  const TZ = 'America/Toronto';
  // DST ends 2026-11-01 (25-hour day in Toronto).
  // Invoice 2026-10-01 -> due 2026-10-31.
  const invoice = new Date(Date.UTC(2026, 9, 1));
  // 2026-10-31 23:30 Toronto (EDT) = 2026-11-01 03:30 UTC — not yet overdue.
  assert.equal(daysOverdue(invoice, new Date(Date.UTC(2026, 10, 1, 3, 30)), TZ), 0);
  // 2026-11-01 00:30 Toronto (EST, after fallback) = 2026-11-01 05:30 UTC — overdue.
  assert.equal(daysOverdue(invoice, new Date(Date.UTC(2026, 10, 1, 5, 30)), TZ), 1);
  // The old 24h-block math would have been an hour off here; calendar days are exact.
});

test('daysOverdue is immune to DST transitions (23-hour day)', () => {
  const TZ = 'America/Toronto';
  // DST starts 2026-03-08 (23-hour day in Toronto).
  // Invoice 2026-02-06 -> due 2026-03-08.
  const invoice = new Date(Date.UTC(2026, 1, 6));
  // 2026-03-08 23:30 Toronto (EDT) = 2026-03-09 03:30 UTC — not yet overdue.
  assert.equal(daysOverdue(invoice, new Date(Date.UTC(2026, 2, 9, 3, 30)), TZ), 0);
  // 2026-03-09 00:30 Toronto = 2026-03-09 04:30 UTC — 1 day overdue.
  assert.equal(daysOverdue(invoice, new Date(Date.UTC(2026, 2, 9, 4, 30)), TZ), 1);
});

test('needsFollowUp: SENT quotes older than 3 days qualify', () => {
  assert.equal(needsFollowUp(at(2 * DAY_MS)), false, '2-day-old quote not stale');
  assert.equal(needsFollowUp(at(FOLLOWUP_AFTER_DAYS * DAY_MS)), true, 'exactly 3 days qualifies');
  assert.equal(needsFollowUp(at(10 * DAY_MS)), true, '10-day-old quote qualifies');
});

test('daysWaiting counts whole days since update', () => {
  assert.equal(daysWaiting(at(5 * DAY_MS)), 5);
  assert.equal(daysWaiting(at(0)), 0);
});

test('remainingBalance subtracts payments, clamps at 0', () => {
  assert.equal(remainingBalance(1000, [400, 250]), 350);
  assert.equal(remainingBalance(1000, []), 1000);
  assert.equal(remainingBalance(1000, [1200]), 0, 'overpayment clamps to 0');
});

test('remainingBalance rounds to cents', () => {
  assert.equal(remainingBalance(100, [33.333]), 66.67);
});
