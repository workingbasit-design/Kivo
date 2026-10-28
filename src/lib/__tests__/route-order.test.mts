import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { orderStops, formatRouteDistance } from '../route-order.ts';

// Triangle around a start at (0, 0): A is nearest, then B, then C —
// regardless of input order.
const A = { id: 'a', lat: 0.01, lng: 0, startTime: '09:00' };
const B = { id: 'b', lat: 0.02, lng: 0, startTime: '10:00' };
const C = { id: 'c', lat: 0.05, lng: 0, startTime: '11:00' };

describe('orderStops', () => {
  it('orders by distance from the start, not input order', () => {
    const out = orderStops([C, A, B], { lat: 0, lng: 0 });
    assert.deepEqual(out.map((s) => s.id), ['a', 'b', 'c']);
    assert.deepEqual(out.map((s) => s.order), [1, 2, 3]);
    assert.equal(out[0].unordered, false);
    // First stop's distance is from the start point.
    assert.ok((out[0].distanceFromPrevMeters ?? 0) > 0);
    // B follows A: ~1.1 km further along the same meridian.
    assert.ok((out[1].distanceFromPrevMeters ?? 0) > 1000);
  });

  it('greedy walk: after visiting A, the next stop is nearest to A', () => {
    // From the start, B and C are both far east; A is north but near.
    // After A, the walk continues to whichever is nearest to A.
    const east1 = { id: 'e1', lat: 0.01, lng: 0.1, startTime: '09:00' };
    const east2 = { id: 'e2', lat: 0.01, lng: 0.2, startTime: '10:00' };
    const out = orderStops([east2, east1, A], { lat: 0, lng: 0 });
    assert.deepEqual(out.map((s) => s.id), ['a', 'e1', 'e2']);
  });

  it('ties break by earlier start time, then id', () => {
    const early = { id: 'z', lat: 0.01, lng: 0.01, startTime: '08:00' };
    const late = { id: 'y', lat: 0.01, lng: -0.01, startTime: '09:00' };
    // Both are equidistant from (0,0).
    const out = orderStops([late, early], { lat: 0, lng: 0 });
    assert.equal(out[0].id, 'z');
    const sameTime1 = { id: 'b', lat: 0.01, lng: 0.01, startTime: '08:00' };
    const sameTime2 = { id: 'a', lat: 0.01, lng: -0.01, startTime: '08:00' };
    const out2 = orderStops([sameTime1, sameTime2], { lat: 0, lng: 0 });
    assert.equal(out2[0].id, 'a');
  });

  it('stops without coordinates go last in start-time order', () => {
    const noLoc1 = { id: 'n1', startTime: '12:00' };
    const noLoc2 = { id: 'n2', startTime: '08:00' };
    const out = orderStops([noLoc1, A, noLoc2], { lat: 0, lng: 0 });
    assert.deepEqual(out.map((s) => s.id), ['a', 'n2', 'n1']);
    assert.equal(out[1].unordered, true);
    assert.equal(out[1].order, null);
    assert.equal(out[1].distanceFromPrevMeters, null);
  });

  it('no start: seeds with the earliest coordinated stop', () => {
    const out = orderStops([C, B, A]);
    assert.deepEqual(out.map((s) => s.id), ['a', 'b', 'c']);
    assert.equal(out[0].distanceFromPrevMeters, null);
  });

  it('empty list and single stop', () => {
    assert.deepEqual(orderStops([]), []);
    const single = orderStops([A], { lat: 0, lng: 0 });
    assert.equal(single.length, 1);
    assert.equal(single[0].order, 1);
  });

  it('does not mutate inputs', () => {
    const input = [C, A];
    const snapshot = JSON.stringify(input);
    orderStops(input, { lat: 0, lng: 0 });
    assert.equal(JSON.stringify(input), snapshot);
  });
});

describe('formatRouteDistance', () => {
  it('formats metres and kilometres', () => {
    assert.equal(formatRouteDistance(350), '350 m');
    assert.equal(formatRouteDistance(999), '999 m');
    assert.equal(formatRouteDistance(1200), '1.2 km');
    assert.equal(formatRouteDistance(null), null);
    assert.equal(formatRouteDistance(-5), null);
  });
});
