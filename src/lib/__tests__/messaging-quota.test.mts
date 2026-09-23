/**
 * Unit tests for messaging quota guardrails (src/lib/messaging/quota.ts).
 * Run: node --test src/lib/__tests__/messaging-quota.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  monthKeyInTimezone,
  quotaAllows,
  quotaRemaining,
  quotaPercentUsed,
} from '../messaging/quota.ts';

/* ---------------- monthKeyInTimezone ---------------- */

test('monthKeyInTimezone returns YYYY-MM in the business timezone', () => {
  assert.equal(monthKeyInTimezone(new Date('2026-09-15T12:00:00Z'), 'America/Toronto'), '2026-09');
  assert.equal(monthKeyInTimezone(new Date('2026-01-05T08:00:00Z'), 'America/Toronto'), '2026-01');
});

test('monthKeyInTimezone respects the month boundary in the business timezone', () => {
  // 2026-09-01T03:30:00Z is still Aug 31 23:30 in America/Toronto (EDT).
  assert.equal(monthKeyInTimezone(new Date('2026-09-01T03:30:00Z'), 'America/Toronto'), '2026-08');
  // Same instant is Sep 1 in UTC.
  assert.equal(monthKeyInTimezone(new Date('2026-09-01T03:30:00Z'), 'UTC'), '2026-09');
});

test('monthKeyInTimezone handles year boundaries', () => {
  // 2027-01-01T02:00:00Z is Dec 31 21:00 in America/Toronto (EST).
  assert.equal(monthKeyInTimezone(new Date('2027-01-01T02:00:00Z'), 'America/Toronto'), '2026-12');
});

/* ---------------- quotaAllows ---------------- */

test('quotaAllows is true only while used < limit', () => {
  assert.equal(quotaAllows(0, 100), true);
  assert.equal(quotaAllows(99, 100), true);
  assert.equal(quotaAllows(100, 100), false); // at the limit: blocked
  assert.equal(quotaAllows(150, 100), false); // over the limit: blocked
  assert.equal(quotaAllows(0, 0), false);
});

/* ---------------- quotaRemaining ---------------- */

test('quotaRemaining floors at 0', () => {
  assert.equal(quotaRemaining(0, 100), 100);
  assert.equal(quotaRemaining(30, 100), 70);
  assert.equal(quotaRemaining(100, 100), 0);
  assert.equal(quotaRemaining(150, 100), 0); // never negative
});

/* ---------------- quotaPercentUsed ---------------- */

test('quotaPercentUsed rounds to 0..100 and guards bad limits', () => {
  assert.equal(quotaPercentUsed(0, 100), 0);
  assert.equal(quotaPercentUsed(50, 100), 50);
  assert.equal(quotaPercentUsed(1, 3), 33);
  assert.equal(quotaPercentUsed(2, 3), 67);
  assert.equal(quotaPercentUsed(100, 100), 100);
  assert.equal(quotaPercentUsed(150, 100), 100); // clamped
  assert.equal(quotaPercentUsed(0, 0), 0); // guarded
  assert.equal(quotaPercentUsed(10, -5), 0); // guarded
});

/* ---------------- dayKeyInTimezone (Resend free tier: 100/day cap) ---------------- */

test('dayKeyInTimezone returns YYYY-MM-DD in the business timezone', async () => {
  const { dayKeyInTimezone } = await import('../messaging/quota.ts');
  assert.equal(dayKeyInTimezone(new Date('2026-09-23T12:00:00Z'), 'America/Toronto'), '2026-09-23');
});

test('dayKeyInTimezone respects the day boundary in the business timezone', async () => {
  const { dayKeyInTimezone } = await import('../messaging/quota.ts');
  // 2026-09-24T03:30:00Z is still Sep 23 23:30 in America/Toronto (EDT).
  assert.equal(dayKeyInTimezone(new Date('2026-09-24T03:30:00Z'), 'America/Toronto'), '2026-09-23');
  assert.equal(dayKeyInTimezone(new Date('2026-09-24T03:30:00Z'), 'UTC'), '2026-09-24');
});

test('VERIFIED_QUOTA_DEFAULTS matches the researched free tiers', async () => {
  const { VERIFIED_QUOTA_DEFAULTS } = await import('../messaging/quota.ts');
  // Meta: 1,000 free service messages / month / number.
  assert.equal(VERIFIED_QUOTA_DEFAULTS.whatsappMonthly, 1000);
  // Resend free tier: 3,000 / month AND 100 / day.
  assert.equal(VERIFIED_QUOTA_DEFAULTS.emailMonthly, 3000);
  assert.equal(VERIFIED_QUOTA_DEFAULTS.emailDaily, 100);
});
