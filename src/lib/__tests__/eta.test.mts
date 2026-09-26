/**
 * Unit tests for the customer-tracking ETA helpers (src/lib/eta.ts).
 * Pure formatters are tested exactly; the OSRM network call is tested only
 * for its graceful-null contract via a stubbed fetch (hermetic, no network).
 * Run: node --test src/lib/__tests__/eta.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDistance, formatEta, fetchDrivingEta } from '../eta.ts';

// ── formatDistance ────────────────────────────────────────────────────

test('formatDistance renders metres under 1 km', () => {
  assert.equal(formatDistance(850, 'en'), '850 m');
  assert.equal(formatDistance(44, 'en'), '40 m'); // rounded to 10 m
});

test('formatDistance renders kilometres above 1 km', () => {
  assert.equal(formatDistance(2400, 'en'), '2.4 km');
  assert.equal(formatDistance(12500, 'en'), '13 km');
});

test('formatDistance is locale-aware', () => {
  assert.equal(formatDistance(2400, 'fr'), '2,4 km');
});

test('formatDistance rejects bad input', () => {
  assert.equal(formatDistance(NaN, 'en'), '');
  assert.equal(formatDistance(-5, 'en'), '');
});

// ── formatEta ─────────────────────────────────────────────────────────

test('formatEta renders minutes', () => {
  assert.equal(formatEta(540, 'en'), '~9 min');
  assert.equal(formatEta(30, 'en'), '~1 min'); // minimum 1 minute
});

test('formatEta renders hours and minutes', () => {
  assert.equal(formatEta(3900, 'en'), '~1 h 5 min');
  assert.equal(formatEta(7200, 'en'), '~2 h');
});

test('formatEta rejects bad input', () => {
  assert.equal(formatEta(NaN, 'en'), '');
  assert.equal(formatEta(-10, 'en'), '');
});

// ── fetchDrivingEta ───────────────────────────────────────────────────

test('fetchDrivingEta returns null for invalid coordinates', async () => {
  assert.equal(await fetchDrivingEta(NaN, 0, 0, 0), null);
});

test('fetchDrivingEta parses a valid OSRM response', async () => {
  const realFetch = globalThis.fetch;
  (globalThis as any).fetch = async () =>
    new Response(
      JSON.stringify({ routes: [{ distance: 3210.5, duration: 482 }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  try {
    const eta = await fetchDrivingEta(43.65, -79.38, 43.7, -79.4);
    assert.deepEqual(eta, { distanceM: 3210.5, durationS: 482 });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('fetchDrivingEta returns null when OSRM fails', async () => {
  const realFetch = globalThis.fetch;
  (globalThis as any).fetch = async () => {
    throw new Error('network down');
  };
  try {
    // Use fresh coordinates to avoid the success-case cache entry above.
    assert.equal(await fetchDrivingEta(44.1, -79.1, 44.2, -79.2), null);
  } finally {
    globalThis.fetch = realFetch;
  }
});
