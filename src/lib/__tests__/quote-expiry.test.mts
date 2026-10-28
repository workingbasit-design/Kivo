import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expiryEndOfDay,
  isQuoteExpired,
  isValidDateKey,
} from '../quote-expiry.ts';

test('isValidDateKey rejects rollover dates and garbage', () => {
  assert.equal(isValidDateKey('2026-02-30'), false);
  assert.equal(isValidDateKey('2026-02-28'), true);
  assert.equal(isValidDateKey('2024-02-29'), true);
  assert.equal(isValidDateKey('2026-02-29'), false);
  assert.equal(isValidDateKey('2026-13-01'), false);
  assert.equal(isValidDateKey('2026-00-10'), false);
  assert.equal(isValidDateKey('tomorrow'), false);
  assert.equal(isValidDateKey('2026-1-5'), false);
});

test('isQuoteExpired: only SENT + past expiresAt', () => {
  const now = new Date('2026-10-28T12:00:00Z');
  const past = new Date('2026-10-27T23:59:59.999Z');
  const future = new Date('2026-10-29T23:59:59.999Z');
  assert.equal(isQuoteExpired({ status: 'SENT', expiresAt: past }, now), true);
  assert.equal(isQuoteExpired({ status: 'SENT', expiresAt: future }, now), false);
  assert.equal(isQuoteExpired({ status: 'SENT', expiresAt: null }, now), false);
  assert.equal(isQuoteExpired({ status: 'DRAFT', expiresAt: past }, now), false);
  assert.equal(isQuoteExpired({ status: 'APPROVED', expiresAt: past }, now), false);
  // Exactly at the expiry instant: not yet past (now > expiresAt is strict).
  assert.equal(isQuoteExpired({ status: 'SENT', expiresAt: now }, now), false);
});

test('expiryEndOfDay: end of the business-tz day, DST-aware', () => {
  // Oct 28 2026 is EDT (UTC-4): end of day = Oct 29 03:59:59.999Z.
  assert.equal(
    expiryEndOfDay('2026-10-28', 'America/Toronto').toISOString(),
    '2026-10-29T03:59:59.999Z'
  );
  // Nov 1 2026 is the EST switchover (UTC-5 from 2am): end of day is
  // Nov 2 04:59:59.999Z, not 03:59 — a naive +24h would be wrong.
  assert.equal(
    expiryEndOfDay('2026-11-01', 'America/Toronto').toISOString(),
    '2026-11-02T04:59:59.999Z'
  );
  // No timezone given defaults to Toronto (parseDateInputInTimezone).
  assert.equal(
    expiryEndOfDay('2026-10-28').toISOString(),
    '2026-10-29T03:59:59.999Z'
  );
});
