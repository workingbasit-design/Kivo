/**
 * Location ping payload validation (POST /api/locations/ping).
 *
 * Regression: accuracy 0 — a legitimate reading from desktop / Wi-Fi
 * positioning — used to be rejected by z.number().positive(), and the
 * sharing card failed silently. The schema now accepts >= 0 while still
 * rejecting negative/absurd accuracy and out-of-range coordinates.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { locationPingSchema } from '../location-ping.ts';

const base = { lat: 43.6532, lng: -79.3832, jobId: 'job-1' };

describe('locationPingSchema', () => {
  it('accepts accuracy 0 (unknown accuracy is a legitimate reading)', () => {
    assert.equal(locationPingSchema.safeParse({ ...base, accuracy: 0 }).success, true);
  });

  it('accepts a typical phone accuracy and an omitted accuracy', () => {
    assert.equal(locationPingSchema.safeParse({ ...base, accuracy: 12 }).success, true);
    assert.equal(locationPingSchema.safeParse(base).success, true);
  });

  it('rejects negative accuracy', () => {
    assert.equal(locationPingSchema.safeParse({ ...base, accuracy: -1 }).success, false);
  });

  it('rejects absurd accuracy above the cap', () => {
    assert.equal(locationPingSchema.safeParse({ ...base, accuracy: 100_001 }).success, false);
    assert.equal(locationPingSchema.safeParse({ ...base, accuracy: 100_000 }).success, true);
  });

  it('rejects out-of-range coordinates', () => {
    assert.equal(locationPingSchema.safeParse({ ...base, lat: 90.1 }).success, false);
    assert.equal(locationPingSchema.safeParse({ ...base, lat: -90.1 }).success, false);
    assert.equal(locationPingSchema.safeParse({ ...base, lng: 180.1 }).success, false);
    assert.equal(locationPingSchema.safeParse({ ...base, lng: -180.1 }).success, false);
    assert.equal(
      locationPingSchema.safeParse({ lat: 90, lng: -180, jobId: 'job-1' }).success,
      true
    );
  });

  it('rejects a missing or empty jobId', () => {
    assert.equal(locationPingSchema.safeParse({ lat: 0, lng: 0 }).success, false);
    assert.equal(locationPingSchema.safeParse({ ...base, jobId: '' }).success, false);
  });
});
