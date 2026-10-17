/**
 * Part C (dashboard rebuild): unit tests for the pure section helpers.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs
 *      src/lib/__tests__/dashboard-sections.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToKey,
  weekdayIndex,
  weekDayKeys,
  monthKeys,
  bucketSumsByDay,
  changePct,
  areaFromAddress,
  initialsOf,
  uniqueInitials,
  agingSplit,
  tradeIconNameForJob,
} from '../dashboard-sections.ts';

test('addDaysToKey crosses month and year boundaries', () => {
  assert.equal(addDaysToKey('2026-10-17', 1), '2026-10-18');
  assert.equal(addDaysToKey('2026-10-01', -1), '2026-09-30');
  assert.equal(addDaysToKey('2026-01-01', -1), '2025-12-31');
  assert.equal(addDaysToKey('2026-02-28', 1), '2026-03-01');
});

test('weekdayIndex: 0 = Monday', () => {
  // 2026-10-17 is a Saturday.
  assert.equal(weekdayIndex('2026-10-17'), 5);
  assert.equal(weekdayIndex('2026-10-19'), 0);
  assert.equal(weekdayIndex('2026-10-18'), 6);
});

test('weekDayKeys returns Mon..Sun containing the day', () => {
  const keys = weekDayKeys('2026-10-17'); // Saturday
  assert.deepEqual(keys, [
    '2026-10-12',
    '2026-10-13',
    '2026-10-14',
    '2026-10-15',
    '2026-10-16',
    '2026-10-17',
    '2026-10-18',
  ]);
});

test('monthKeys returns oldest-first YYYY-MM ending with the current month', () => {
  assert.deepEqual(monthKeys('2026-10-17', 3), ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(monthKeys('2026-01-15', 2), ['2025-12', '2026-01']);
});

test('bucketSumsByDay buckets by business-local day', () => {
  // 2026-10-17T02:30Z is 2026-10-16 22:30 in America/Toronto (UTC-4).
  const items = [
    { at: new Date('2026-10-17T14:00:00Z'), amount: 100 },
    { at: new Date('2026-10-17T02:30:00Z'), amount: 50 },
  ];
  const sums = bucketSumsByDay(items, ['2026-10-16', '2026-10-17'], 'America/Toronto');
  assert.deepEqual(sums, [50, 100]);
});

test('changePct rounds and returns null with no baseline', () => {
  assert.equal(changePct(118, 100), 18);
  assert.equal(changePct(90, 100), -10);
  assert.equal(changePct(50, 0), null);
});

test('areaFromAddress takes the city segment, never a postal code', () => {
  assert.equal(areaFromAddress('1423 Eglinton Ave W, Etobicoke'), 'Etobicoke');
  assert.equal(areaFromAddress('5080 Dixie Rd, Mississauga'), 'Mississauga');
  assert.equal(areaFromAddress('1 Main St, Toronto, ON M5H 1J9'), 'Toronto');
  assert.equal(areaFromAddress(null), null);
  assert.equal(areaFromAddress('NoCommaStreet'), 'NoCommaStreet');
});

test('initialsOf and uniqueInitials', () => {
  assert.equal(initialsOf('Daniel Okafor'), 'DO');
  assert.equal(initialsOf('Jay'), 'J');
  assert.deepEqual(uniqueInitials(['Priya Shah', 'Priya Singh', 'Wei Chen', 'Ana Ruiz'], 3), [
    'PS',
    'WC',
    'AR',
  ]);
});

test('agingSplit buckets by days overdue', () => {
  const out = agingSplit([
    { outstanding: 100, overdueDays: 0 },
    { outstanding: 200, overdueDays: 10 },
    { outstanding: 300, overdueDays: 45 },
    { outstanding: 400, overdueDays: 90 },
  ]);
  assert.deepEqual(out, { current: 100, d1_30: 200, d31_60: 300, over60: 400 });
});

test('tradeIconNameForJob prefers the service override, then keywords', () => {
  assert.equal(
    tradeIconNameForJob({
      title: 'Whatever',
      service: { name: 'Window washing', iconKey: 'furnace' },
    }),
    'Flame'
  );
  assert.equal(tradeIconNameForJob({ title: 'Gutter cleaning', service: null }), 'Drop');
  assert.equal(tradeIconNameForJob({ title: 'Deep clean, 3 bedroom' }), 'Broom');
  assert.equal(tradeIconNameForJob({ title: 'Mystery task' }), 'Hammer');
});
