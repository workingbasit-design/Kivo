/**
 * P1.0 (audit S4): the durable DB-backed rate limiter.
 *
 * - The count lives in the RateLimit table (stubbed here with an
 *   in-memory Map), not in module state — so the limit holds across
 *   Vercel serverless instances and cold starts, unlike the in-memory
 *   token bucket.
 * - Fails CLOSED on a DB error (deny + log) for auth buckets.
 * - Same three-way E2E gate as the in-memory limiter (S5): both flags +
 *   non-production NODE_ENV, or the bypass stays off.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./rate-limit-durable-stub-loader.mjs', import.meta.url);

const { rateLimitDurable } = await import('../rate-limit-durable.ts');
const stub = await import('./rate-limit-durable-stub.mjs');

async function withEnv(vars, fn) {
  const prev = {};
  for (const k of Object.keys(vars)) {
    prev[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    return await fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

describe('rateLimitDurable (S4)', () => {
  it('blocks the 9th attempt at limit 8', async () => {
    const key = `durable-block-${Date.now()}`;
    for (let i = 0; i < 8; i++) {
      const r = await rateLimitDurable(key, { limit: 8, windowMs: 60_000 });
      assert.equal(r.ok, true);
    }
    const blocked = await rateLimitDurable(key, { limit: 8, windowMs: 60_000 });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.retryAfterMs > 0 && blocked.retryAfterMs <= 60_000);
  });

  it('keeps the count in the store, not in module state', async () => {
    // A second serverless instance reads the same table, so it must see
    // the same count. Assert the store holds the count after the calls.
    const key = `durable-store-${Date.now()}`;
    stub.rateLimitStore.clear();
    await rateLimitDurable(key, { limit: 8, windowMs: 60_000 });
    await rateLimitDurable(key, { limit: 8, windowMs: 60_000 });
    await rateLimitDurable(key, { limit: 8, windowMs: 60_000 });
    const row = stub.rateLimitStore.get(key);
    assert.ok(row, 'bucket row must exist in the store');
    assert.equal(row.count, 3);
  });

  it('window expiry resets the bucket', async () => {
    const key = `durable-reset-${Date.now()}`;
    assert.equal((await rateLimitDurable(key, { limit: 1, windowMs: 30 })).ok, true);
    assert.equal((await rateLimitDurable(key, { limit: 1, windowMs: 30 })).ok, false);
    await new Promise((res) => setTimeout(res, 50));
    const r = await rateLimitDurable(key, { limit: 1, windowMs: 30 });
    assert.equal(r.ok, true);
    assert.equal(r.remaining, 0);
  });

  it('fails closed (deny) when the DB errors', async () => {
    const key = `durable-dberr-${Date.now()}`;
    stub.setRateLimitShouldThrow(true);
    const origError = console.error;
    console.error = () => {};
    try {
      const r = await rateLimitDurable(key, { limit: 8, windowMs: 60_000 });
      assert.equal(r.ok, false);
      assert.equal(r.remaining, 0);
    } finally {
      console.error = origError;
      stub.setRateLimitShouldThrow(false);
    }
  });

  it('E2E gate: both flags + non-production NODE_ENV bypasses without touching the store', async () => {
    const key = `durable-e2e-${Date.now()}`;
    stub.rateLimitStore.clear();
    await withEnv(
      { E2E_DISABLE_RATE_LIMIT: '1', E2E_TEST_SERVER: '1', NODE_ENV: 'test' },
      async () => {
        for (let i = 0; i < 5; i++) {
          assert.equal(
            (await rateLimitDurable(key, { limit: 2, windowMs: 60_000 })).ok,
            true,
          );
        }
      },
    );
    assert.equal(stub.rateLimitStore.has(key), false);
  });

  it('E2E gate: disable flag alone does not bypass', async () => {
    const key = `durable-e2e-alone-${Date.now()}`;
    await withEnv(
      { E2E_DISABLE_RATE_LIMIT: '1', E2E_TEST_SERVER: undefined, NODE_ENV: 'test' },
      async () => {
        assert.equal((await rateLimitDurable(key, { limit: 2, windowMs: 60_000 })).ok, true);
        assert.equal((await rateLimitDurable(key, { limit: 2, windowMs: 60_000 })).ok, true);
        assert.equal((await rateLimitDurable(key, { limit: 2, windowMs: 60_000 })).ok, false);
      },
    );
  });

  it('E2E gate: both flags + NODE_ENV=production does not bypass', async () => {
    const key = `durable-e2e-prod-${Date.now()}`;
    await withEnv(
      { E2E_DISABLE_RATE_LIMIT: '1', E2E_TEST_SERVER: '1', NODE_ENV: 'production' },
      async () => {
        assert.equal((await rateLimitDurable(key, { limit: 2, windowMs: 60_000 })).ok, true);
        assert.equal((await rateLimitDurable(key, { limit: 2, windowMs: 60_000 })).ok, true);
        assert.equal((await rateLimitDurable(key, { limit: 2, windowMs: 60_000 })).ok, false);
      },
    );
  });
});
