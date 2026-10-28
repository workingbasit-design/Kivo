import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidDayOfMonth,
  previousMonthKey,
  nextMonthKey,
  isMonthlyGenerationDay,
  selectMonthlyVisits,
} from '../invoice-schedules.ts';

describe('isValidDayOfMonth', () => {
  it('accepts 1–28 integers only', () => {
    assert.equal(isValidDayOfMonth(1), true);
    assert.equal(isValidDayOfMonth(28), true);
    assert.equal(isValidDayOfMonth(0), false);
    assert.equal(isValidDayOfMonth(29), false);
    assert.equal(isValidDayOfMonth(31), false);
    assert.equal(isValidDayOfMonth(15.5), false);
    assert.equal(isValidDayOfMonth('15'), false);
    assert.equal(isValidDayOfMonth(null), false);
    assert.equal(isValidDayOfMonth(undefined), false);
  });
});

describe('month key math', () => {
  it('previous month incl. year boundary', () => {
    assert.equal(previousMonthKey('2026-10'), '2026-09');
    assert.equal(previousMonthKey('2026-01'), '2025-12');
    assert.equal(previousMonthKey('2026-12'), '2026-11');
  });
  it('next month incl. year boundary', () => {
    assert.equal(nextMonthKey('2026-12'), '2027-01');
    assert.equal(nextMonthKey('2026-09'), '2026-10');
  });
  it('passes malformed keys through', () => {
    assert.equal(previousMonthKey('garbage'), 'garbage');
  });
});

describe('isMonthlyGenerationDay', () => {
  it('matches only a valid equal day', () => {
    assert.equal(isMonthlyGenerationDay(15, 15), true);
    assert.equal(isMonthlyGenerationDay(15, 16), false);
    assert.equal(isMonthlyGenerationDay(29, 29), false);
    assert.equal(isMonthlyGenerationDay(null, 15), false);
    assert.equal(isMonthlyGenerationDay(undefined, 15), false);
  });
});

describe('selectMonthlyVisits', () => {
  const base = {
    status: 'COMPLETED',
    skippedAt: null,
    dateKey: '2026-09-15',
  };
  it('keeps completed, unskipped, in-period, uninvoiced visits', () => {
    const out = selectMonthlyVisits(
      [{ id: 'a', ...base }],
      '2026-09',
      new Set()
    );
    assert.deepEqual(out.map((v) => v.id), ['a']);
  });
  it('excludes non-completed, skipped, out-of-period, already-invoiced', () => {
    const out = selectMonthlyVisits(
      [
        { id: 'sched', ...base, status: 'SCHEDULED' },
        { id: 'skip', ...base, skippedAt: new Date() },
        { id: 'oct', ...base, dateKey: '2026-10-02' },
        { id: 'billed', ...base },
      ],
      '2026-09',
      new Set(['billed'])
    );
    assert.deepEqual(out, []);
  });
});
