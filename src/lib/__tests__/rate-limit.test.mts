/**
 * Unit tests for the in-memory rate limiter (src/lib/rate-limit.ts).
 * Note: the limiter keeps module-level state; tests use unique keys.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit } from '../rate-limit.ts';

test('allows requests under the limit', () => {
  const key = `test-under-${Date.now()}`;
  for (let i = 0; i < 5; i++) {
    const r = rateLimit(key, { limit: 5, windowMs: 60_000 });
    assert.equal(r.ok, true);
  }
});

test('blocks the request over the limit and reports retry-after', () => {
  const key = `test-over-${Date.now()}`;
  for (let i = 0; i < 3; i++) rateLimit(key, { limit: 3, windowMs: 60_000 });
  const r = rateLimit(key, { limit: 3, windowMs: 60_000 });
  assert.equal(r.ok, false);
  assert.equal(r.remaining, 0);
  assert.ok(r.retryAfterMs > 0 && r.retryAfterMs <= 60_000);
});

test('window expiry resets the bucket', async () => {
  const key = `test-reset-${Date.now()}`;
  rateLimit(key, { limit: 1, windowMs: 30 });
  assert.equal(rateLimit(key, { limit: 1, windowMs: 30 }).ok, false);
  await new Promise((res) => setTimeout(res, 50));
  const r = rateLimit(key, { limit: 1, windowMs: 30 });
  assert.equal(r.ok, true);
  assert.equal(r.remaining, 0);
});

test('keys are isolated from each other', () => {
  const a = `test-iso-a-${Date.now()}`;
  const b = `test-iso-b-${Date.now()}`;
  rateLimit(a, { limit: 1, windowMs: 60_000 });
  assert.equal(rateLimit(a, { limit: 1, windowMs: 60_000 }).ok, false);
  assert.equal(rateLimit(b, { limit: 1, windowMs: 60_000 }).ok, true);
});
