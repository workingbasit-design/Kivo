/**
 * Unit tests for the privacy-first geofencing helpers (src/lib/geofence.ts).
 * Pure math is tested exactly; Nominatim calls run against a stubbed fetch so
 * the suite is hermetic (no network).
 * Run: node --test src/lib/__tests__/geofence.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineMeters,
  isWithinRadius,
  detectArrival,
  cacheKeyForPoint,
  geocodeAddress,
  reverseGeocode,
  checkArrival,
  ARRIVAL_RADIUS_M,
} from '../geofence.ts';

// ── haversine ─────────────────────────────────────────────────────────────

test('haversine: same point is zero', () => {
  assert.equal(haversineMeters(43.6532, -79.3832, 43.6532, -79.3832), 0);
});

test('haversine: Toronto to Montreal ≈ 504 km', () => {
  // Toronto (43.6532, -79.3832) → Montreal (45.5017, -73.5673)
  const m = haversineMeters(43.6532, -79.3832, 45.5017, -73.5673);
  assert.ok(m > 495_000 && m < 515_000, `expected ~504km, got ${m}`);
});

test('haversine: 1 degree of latitude ≈ 111.2 km', () => {
  const m = haversineMeters(43, -79, 44, -79);
  assert.ok(m > 111_000 && m < 111_400, `got ${m}`);
});

test('haversine: ~150 m for a small offset', () => {
  // 0.00135° latitude ≈ 150 m.
  const m = haversineMeters(43.6532, -79.3832, 43.65455, -79.3832);
  assert.ok(m > 140 && m < 160, `got ${m}`);
});

// ── isWithinRadius / detectArrival ────────────────────────────────────────

test('isWithinRadius: inside and outside the radius', () => {
  // ~100 m away → inside 150 m.
  assert.equal(isWithinRadius(43.6532, -79.3832, 43.6541, -79.3832, 150), true);
  // ~500 m away → outside 150 m.
  assert.equal(isWithinRadius(43.6532, -79.3832, 43.6577, -79.3832, 150), false);
});

test('isWithinRadius: rejects invalid radii', () => {
  assert.equal(isWithinRadius(43, -79, 43, -79, -1), false);
  assert.equal(isWithinRadius(43, -79, 43, -79, NaN), false);
});

test('detectArrival: arrived when within the default 150 m radius', () => {
  const r = detectArrival(
    { lat: 43.6532, lng: -79.3832 },
    { lat: 43.6541, lng: -79.3832 }
  );
  assert.ok(r, 'expected a result');
  assert.equal(r.arrived, true);
  assert.ok(r.distanceM > 90 && r.distanceM < 115, `got ${r.distanceM}`);
  assert.equal(ARRIVAL_RADIUS_M, 150);
});

test('detectArrival: not arrived when far away', () => {
  const r = detectArrival(
    { lat: 43.6532, lng: -79.3832 },
    { lat: 43.7, lng: -79.3832 }
  );
  assert.ok(r, 'expected a result');
  assert.equal(r.arrived, false);
  assert.ok(r.distanceM > 4000, `got ${r.distanceM}`);
});

test('detectArrival: null on invalid coordinates (never throws)', () => {
  assert.equal(
    detectArrival({ lat: NaN, lng: -79 }, { lat: 43, lng: -79 }),
    null
  );
  assert.equal(
    detectArrival({ lat: 43, lng: -79 }, { lat: 43, lng: Infinity }),
    null
  );
});

test('cacheKeyForPoint: rounds to 4 decimals for stable keys', () => {
  assert.equal(cacheKeyForPoint(43.65321, -79.38321), '43.6532,-79.3832');
  assert.equal(cacheKeyForPoint(43.6532, -79.3832), cacheKeyForPoint(43.65321, -79.38324));
});

// ── Nominatim (stubbed fetch) ─────────────────────────────────────────────

function stubFetchOnce(impl: (url: string) => unknown) {
  const prev = globalThis.fetch;
  (globalThis as Record<string, unknown>).fetch = async (url: unknown) => impl(String(url));
  return () => {
    (globalThis as Record<string, unknown>).fetch = prev;
  };
}

test('geocodeAddress: parses a Nominatim search response', async () => {
  const restore = stubFetchOnce(() => ({
    ok: true,
    json: async () => [
      { lat: '43.6532', lon: '-79.3832', display_name: 'Toronto, Ontario, Canada' },
    ],
  }));
  try {
    const r = await geocodeAddress('10 Test St Uniqueville Toronto');
    assert.ok(r, 'expected a result');
    assert.equal(r.lat, 43.6532);
    assert.equal(r.lng, -79.3832);
    assert.equal(r.displayName, 'Toronto, Ontario, Canada');
  } finally {
    restore();
  }
});

test('geocodeAddress: empty address returns null without network', async () => {
  let called = false;
  const restore = stubFetchOnce(() => {
    called = true;
    return { ok: true, json: async () => [] };
  });
  try {
    assert.equal(await geocodeAddress('   '), null);
    assert.equal(called, false, 'fetch must not be called for an empty address');
  } finally {
    restore();
  }
});

test('geocodeAddress: network failure degrades to null (never throws)', async () => {
  const restore = stubFetchOnce(() => {
    throw new Error('network down');
  });
  try {
    assert.equal(await geocodeAddress('1 Failure Rd Nowhere'), null);
  } finally {
    restore();
  }
});

test('geocodeAddress: non-OK response degrades to null', async () => {
  const restore = stubFetchOnce(() => ({ ok: false, status: 429 }));
  try {
    assert.equal(await geocodeAddress('2 Throttled Ave Nowhere'), null);
  } finally {
    restore();
  }
});

test('reverseGeocode: parses a Nominatim reverse response', async () => {
  const restore = stubFetchOnce(() => ({
    ok: true,
    json: async () => ({ display_name: 'King St W, Toronto, Ontario, Canada' }),
  }));
  try {
    const r = await reverseGeocode(43.649, -79.381);
    assert.ok(r, 'expected a result');
    assert.equal(r.displayName, 'King St W, Toronto, Ontario, Canada');
  } finally {
    restore();
  }
});

test('reverseGeocode: failure degrades to null', async () => {
  const restore = stubFetchOnce(() => {
    throw new Error('timeout');
  });
  try {
    assert.equal(await reverseGeocode(43.6491, -79.3811), null);
  } finally {
    restore();
  }
});

test('checkArrival: returns null when the address cannot be geocoded', async () => {
  const restore = stubFetchOnce(() => ({ ok: true, json: async () => [] }));
  try {
    assert.equal(await checkArrival(43.6532, -79.3832, 'Unknown Address Xyz'), null);
    assert.equal(await checkArrival(43.6532, -79.3832, null), null);
    assert.equal(await checkArrival(43.6532, -79.3832, ''), null);
  } finally {
    restore();
  }
});

test('checkArrival: arrived when the tech is at the geocoded address', async () => {
  const restore = stubFetchOnce((url) => {
    assert.ok(url.includes('nominatim.openstreetmap.org'), `unexpected url ${url}`);
    return {
      ok: true,
      json: async () => [
        { lat: '43.6532', lon: '-79.3832', display_name: 'Jobsite, Toronto' },
      ],
    };
  });
  try {
    const r = await checkArrival(43.6533, -79.3833, '99 Jobsite Rd Toronto');
    assert.ok(r, 'expected a result');
    assert.equal(r.arrived, true);
    assert.ok(r.distanceM < 150, `got ${r.distanceM}`);
  } finally {
    restore();
  }
});
