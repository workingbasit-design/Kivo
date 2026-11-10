/**
 * Unit tests for per-business feature flags (src/lib/feature-flags.ts).
 *
 * Regression (2026-11-10 deep test): the F10 `notifications` flag defaulted
 * off with no enablement path anywhere in the app, so notifyEvent() silently
 * dropped every event-driven notification (booking_new, lead_new,
 * quote_accepted/declined, ...) for every business. New businesses must get
 * the flag ON at registration; the Settings toggle covers existing ones.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFlags,
  isFlagOn,
  withFlag,
  serializeFlags,
  defaultFeatureFlags,
  FLAG_NOTIFICATIONS,
} from '../feature-flags.ts';

test('new businesses get instant notifications ON by default', () => {
  const flags = parseFlags(defaultFeatureFlags());
  assert.equal(flags[FLAG_NOTIFICATIONS], true, 'notifications flag must be on for new businesses');
});

test('withFlag turns one flag on and preserves the rest', () => {
  const next = withFlag('{"reports":true}', FLAG_NOTIFICATIONS, true);
  const flags = parseFlags(next);
  assert.equal(flags[FLAG_NOTIFICATIONS], true);
  assert.equal(flags.reports, true);
});

test('withFlag turning a flag off removes only that flag', () => {
  const next = withFlag('{"reports":true,"notifications":true}', FLAG_NOTIFICATIONS, false);
  const flags = parseFlags(next);
  assert.equal(flags[FLAG_NOTIFICATIONS], undefined);
  assert.equal(flags.reports, true);
});

test('parseFlags: null/corrupt -> {} (fail-closed)', () => {
  assert.deepEqual(parseFlags(null), {});
  assert.deepEqual(parseFlags('not-json'), {});
});

test('isFlagOn requires an explicit true', () => {
  assert.equal(isFlagOn({}, FLAG_NOTIFICATIONS), false);
  assert.equal(isFlagOn({ [FLAG_NOTIFICATIONS]: false }, FLAG_NOTIFICATIONS), false);
  assert.equal(isFlagOn({ [FLAG_NOTIFICATIONS]: true }, FLAG_NOTIFICATIONS), true);
});

test('serializeFlags round-trips', () => {
  const raw = serializeFlags({ [FLAG_NOTIFICATIONS]: true, reports: false });
  assert.deepEqual(parseFlags(raw), { [FLAG_NOTIFICATIONS]: true, reports: false });
});
