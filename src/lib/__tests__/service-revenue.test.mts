/**
 * Unit tests for revenue-by-service bucketing (src/lib/revenue-by-service.ts).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { bucketRevenueByService } from '../revenue-by-service.ts';

test('bucketRevenueByService: groups by service name, sums price', () => {
  const rows = bucketRevenueByService(
    [
      { price: 100, serviceName: 'Furnace tune-up' },
      { price: 200, serviceName: 'Furnace tune-up' },
      { price: 50, serviceName: 'Leak repair' },
    ],
    'Other'
  );
  assert.deepEqual(rows, [
    { name: 'Furnace tune-up', revenue: 300, jobs: 2 },
    { name: 'Leak repair', revenue: 50, jobs: 1 },
  ]);
});

test('bucketRevenueByService: sorts by revenue desc', () => {
  const rows = bucketRevenueByService(
    [
      { price: 10, serviceName: 'B' },
      { price: 500, serviceName: 'A' },
    ],
    'Other'
  );
  assert.equal(rows[0].name, 'A');
  assert.equal(rows[1].name, 'B');
});

test('bucketRevenueByService: null/blank service names go under the other label', () => {
  const rows = bucketRevenueByService(
    [
      { price: 75, serviceName: null },
      { price: 25, serviceName: '   ' },
    ],
    'Autre'
  );
  assert.deepEqual(rows, [{ name: 'Autre', revenue: 100, jobs: 2 }]);
});

test('bucketRevenueByService: null price counts as 0 but still counts the job', () => {
  const rows = bucketRevenueByService([{ price: null, serviceName: 'Tune-up' }], 'Other');
  assert.deepEqual(rows, [{ name: 'Tune-up', revenue: 0, jobs: 1 }]);
});

test('bucketRevenueByService: empty input yields empty rows', () => {
  assert.deepEqual(bucketRevenueByService([], 'Other'), []);
});
