/**
 * Unit tests for the Canadian statutory-holiday engine (src/lib/holidays/ca.ts).
 * Known-good dates verified against the official 2026 Canadian holiday calendar.
 * Run: node --test src/lib/__tests__/ca-holidays.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getCaHolidays, isCaHoliday, CA_HOLIDAY_PROVINCES } from '../holidays/ca.ts';

const dates = (year: number, prov?: string) =>
  Object.fromEntries(getCaHolidays(year, prov).map((h) => [h.name, h.date]));

test('2026 federal holidays are correct', () => {
  const d = dates(2026);
  assert.equal(d["New Year's Day"], '2026-01-01');
  assert.equal(d['Good Friday'], '2026-04-03');
  assert.equal(d['Victoria Day'], '2026-05-18'); // Monday on/before May 24
  assert.equal(d['Canada Day'], '2026-07-01');
  assert.equal(d['Labour Day'], '2026-09-07'); // 1st Monday of September
  assert.equal(d['Thanksgiving'], '2026-10-12'); // 2nd Monday of October
  assert.equal(d['Remembrance Day'], '2026-11-11');
  assert.equal(d['Christmas Day'], '2026-12-25');
  assert.equal(d['Boxing Day'], '2026-12-26');
  assert.equal(d['National Day for Truth and Reconciliation'], '2026-09-30');
});

test('Ontario adds Family Day + Civic Holiday', () => {
  const d = dates(2026, 'ON');
  assert.equal(d['Family Day'], '2026-02-16'); // 3rd Monday of February
  assert.equal(d['Civic Holiday'], '2026-08-03'); // 1st Monday of August
  assert.equal(d['Canada Day'], '2026-07-01'); // federal still present
});

test('Quebec adds St-Jean-Baptiste; no Family Day', () => {
  const d = dates(2026, 'QC');
  assert.equal(d['Saint-Jean-Baptiste Day'], '2026-06-24');
  assert.ok(!('Family Day' in d));
});

test('BC / MB / PE floating holidays', () => {
  assert.equal(dates(2026, 'BC')['British Columbia Day'], '2026-08-03');
  assert.equal(dates(2026, 'MB')['Louis Riel Day'], '2026-02-16');
  assert.equal(dates(2026, 'PE')['Gold Cup Parade Day'], '2026-08-21'); // 3rd Friday of Aug
  assert.equal(dates(2026, 'NL')["St. Patrick's Day"], '2026-03-17');
});

test('unknown province code returns federal-only list', () => {
  const all = getCaHolidays(2026, 'ZZ');
  assert.ok(all.length > 0);
  assert.ok(all.every((h) => h.scope === 'federal'));
});

test('results are sorted by date with no duplicates', () => {
  for (const prov of ['ON', 'QC', undefined]) {
    const hs = getCaHolidays(2026, prov);
    const ds = hs.map((h) => h.date);
    assert.deepEqual([...ds].sort(), ds);
    assert.equal(new Set(ds).size, ds.length);
  }
});

test('isCaHoliday works', () => {
  assert.ok(isCaHoliday('2026-07-01', 2026, 'ON'));
  assert.ok(isCaHoliday('2026-02-16', 2026, 'ON')); // Family Day
  assert.ok(!isCaHoliday('2026-02-16', 2026, 'QC')); // not a QC holiday
  assert.ok(!isCaHoliday('2026-07-02', 2026, 'ON'));
});

test('all provinces/territories with extras are covered', () => {
  assert.equal(CA_HOLIDAY_PROVINCES.length, 13);
});

test('floating holidays move year to year (2027 spot checks)', () => {
  const d = dates(2027);
  assert.equal(d['Victoria Day'], '2027-05-24'); // May 24 is a Monday in 2027
  assert.equal(d['Labour Day'], '2027-09-06');
  assert.equal(d['Good Friday'], '2027-03-26');
});
