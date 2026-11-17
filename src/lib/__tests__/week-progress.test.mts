import test from 'node:test';
import assert from 'node:assert/strict';
import { computeWeekProgress, isoWeekNumber } from '../week-progress.ts';

// Week of Mon 2026-10-26 … Sun 2026-11-01; today Tue 2026-10-27 (EDT).
const WEEK_KEYS = [
  '2026-10-26',
  '2026-10-27',
  '2026-10-28',
  '2026-10-29',
  '2026-10-30',
  '2026-10-31',
  '2026-11-01',
];
const TODAY = '2026-10-27';
const TZ = 'America/Toronto';
// Stored instants: Toronto-midnight-as-UTC (the app's date convention).
const day = (key: string, hour = 12) =>
  new Date(`${key}T${String(hour).padStart(2, '0')}:00:00Z`);

test('dots fill on activity days; future days dimmed, never failed', () => {
  const p = computeWeekProgress({
    weekKeys: WEEK_KEYS,
    todayKey: TODAY,
    timezone: TZ,
    jobs: [{ day: day('2026-10-26') }],
    invoices: [{ day: day('2026-10-26') }],
    payments: [{ createdAt: day('2026-10-27'), amountCents: 11300 }],
  });
  assert.deepEqual(p.active, [true, true, false, false, false, false, false]);
  assert.deepEqual(p.future, [false, false, true, true, true, true, true]);
  assert.equal(p.jobsDone, 1);
  assert.equal(p.invoicesIssued, 1);
  assert.equal(p.collectedCents, 11300);
  // Weekly pulse: per-day totals feed the selectable day strip.
  assert.deepEqual(p.perDay[0], { jobsDone: 1, invoicesIssued: 1, collectedCents: 0 });
  assert.deepEqual(p.perDay[1], { jobsDone: 0, invoicesIssued: 0, collectedCents: 11300 });
  assert.deepEqual(p.perDay[2], { jobsDone: 0, invoicesIssued: 0, collectedCents: 0 });
});

test('quiet week: all dots unfilled, totals zero, no streak anywhere', () => {
  const p = computeWeekProgress({
    weekKeys: WEEK_KEYS,
    todayKey: TODAY,
    timezone: TZ,
    jobs: [],
    invoices: [],
    payments: [],
  });
  assert.deepEqual(p.active, [false, false, false, false, false, false, false]);
  assert.equal(p.jobsDone, 0);
  assert.equal(p.invoicesIssued, 0);
  assert.equal(p.collectedCents, 0);
  assert.ok(!JSON.stringify(p).includes('streak'));
});

test('out-of-week rows are ignored entirely', () => {
  const p = computeWeekProgress({
    weekKeys: WEEK_KEYS,
    todayKey: TODAY,
    timezone: TZ,
    jobs: [{ day: day('2026-10-25') }, { day: day('2026-11-02') }],
    invoices: [],
    payments: [],
  });
  assert.deepEqual(p.active, [false, false, false, false, false, false, false]);
  assert.equal(p.jobsDone, 0);
  assert.deepEqual(
    p.perDay.map((d) => d.jobsDone),
    [0, 0, 0, 0, 0, 0, 0],
  );
});

test('isoWeekNumber follows the Thursday rule', () => {
  // Week of Mon 2026-10-26 is ISO week 44.
  assert.equal(isoWeekNumber('2026-10-26'), 44);
  assert.equal(isoWeekNumber('2026-11-01'), 44);
  // 2026-01-01 (Thu) is week 1; 2025-12-29 (Mon) is week 1 of 2026.
  assert.equal(isoWeekNumber('2026-01-01'), 1);
  assert.equal(isoWeekNumber('2025-12-29'), 1);
  // 2026-12-31 (Thu) is week 53.
  assert.equal(isoWeekNumber('2026-12-31'), 53);
});
