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
  assert.equal(daysOverdue(at(10 * DAY_MS)), 0, '10 days old is not overdue');
  assert.equal(daysOverdue(at(OVERDUE_AFTER_DAYS * DAY_MS)), 0, 'exactly 30 is not overdue');
  assert.equal(daysOverdue(at(45 * DAY_MS)), 15, '45 days old is 15 days overdue');
  assert.equal(daysOverdue(new Date(Date.now() + DAY_MS)), 0, 'future date never negative');
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
