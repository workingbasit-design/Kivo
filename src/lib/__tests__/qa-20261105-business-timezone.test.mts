/**
 * Regression tests for the 2026-11-05 exhaustive-sweep finding #3 (MINOR).
 *
 * Server-side dates rendered in server-local time (UTC on Vercel), so after
 * 19:00 EST "today" showed as tomorrow: the /dispatch board defaulted to
 * Nov 5 on the evening of Nov 4, "Customer since" showed Nov 5 for
 * late-evening signups, and the timesheet filter ended Nov 5. All three
 * now anchor to the business timezone.
 *
 * The probe instant 2026-11-05T03:00:00Z is 22:00 EST on Nov 4 — the exact
 * evening window where the bug showed.
 *
 * Run: npm test -- src/lib/__tests__/qa-20261105-business-timezone.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);

const {
  todayInTimezone,
  dayRangeInTimezone,
  formatDateShort,
} = await import('../utils.ts');
const {
  parseDateStart,
  parseDateEnd,
  toDateInputValue,
  addDaysToDateStr,
} = await import('../timesheets.ts');
const { convertedQuoteNumbers } = await import('../quotes.ts');

const EVENING_EST = new Date('2026-11-05T03:00:00Z'); // 22:00 EST Nov 4

test('todayInTimezone: evening EST is still "today" in Toronto, not tomorrow', () => {
  assert.equal(todayInTimezone('America/Toronto', null, EVENING_EST), '2026-11-04');
});

test('dayRangeInTimezone: window is Toronto midnight to Toronto end-of-day', () => {
  const { gte, lte } = dayRangeInTimezone('2026-11-04', 'America/Toronto');
  assert.equal(gte.toISOString(), '2026-11-04T05:00:00.000Z'); // EST = UTC-5
  assert.equal(lte.toISOString(), '2026-11-05T04:59:59.999Z');
});

test('formatDateShort with business timezone: evening instant shows Toronto day', () => {
  assert.equal(formatDateShort(EVENING_EST, 'en-CA', 'America/Toronto'), 'Nov 4, 2026');
  // Date-only strings stay on their calendar day in the same timezone.
  assert.equal(formatDateShort('2026-11-04', 'en-CA', 'America/Toronto'), 'Nov 4, 2026');
});

test('timesheet filter helpers round-trip in the business timezone', () => {
  const start = parseDateStart('2026-11-04', 'America/Toronto');
  assert.equal(start?.toISOString(), '2026-11-04T05:00:00.000Z');
  const end = parseDateEnd('2026-11-04', 'America/Toronto');
  assert.equal(end?.toISOString(), '2026-11-05T04:59:59.999Z');
  assert.equal(toDateInputValue(start!, 'America/Toronto'), '2026-11-04');
  assert.equal(toDateInputValue(end!, 'America/Toronto'), '2026-11-04');
  // Legacy no-timezone behaviour is unchanged (server-local).
  assert.equal(toDateInputValue(new Date(2026, 10, 4, 12)), '2026-11-04');
});

test('addDaysToDateStr: calendar math across month boundaries', () => {
  assert.equal(addDaysToDateStr('2026-11-04', -29), '2026-10-06');
  assert.equal(addDaysToDateStr('2026-01-05', -10), '2025-12-26');
});

test('convertedQuoteNumbers: parses the conversion marker, ignores the rest', () => {
  const numbers = convertedQuoteNumbers([
    'Converted from quote Q-0001. Includes add-ons: Wax ($10.00).',
    'Converted from quote Q-0002.',
    'Regular job notes, no marker.',
    null,
    undefined,
    'Converted from quote Q-0001.', // duplicate: same quote, still one entry
  ]);
  assert.deepEqual([...numbers].sort(), ['Q-0001', 'Q-0002']);
});
