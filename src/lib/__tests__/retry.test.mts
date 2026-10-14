/** B10.3 withRetry tests: backoff, idempotency key stability, fail-fast. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry, newIdempotencyKey } from '../retry.ts';

const noSleep = async () => {};

describe('withRetry', () => {
  it('succeeds on the first attempt', async () => {
    let calls = 0;
    const r = await withRetry(async () => {
      calls++;
      return 'ok';
    }, 'k1', { sleep: noSleep });
    assert.equal(r, 'ok');
    assert.equal(calls, 1);
  });
  it('retries a flaky operation and passes the same idempotency key', async () => {
    const keys: string[] = [];
    let calls = 0;
    const r = await withRetry(async (_attempt, key) => {
      calls++;
      keys.push(key);
      if (calls < 3) throw new Error('flaky');
      return 'recovered';
    }, 'idem-123', { sleep: noSleep });
    assert.equal(r, 'recovered');
    assert.equal(calls, 3);
    assert.deepEqual(keys, ['idem-123', 'idem-123', 'idem-123']);
  });
  it('gives up after maxAttempts and throws the last error', async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(async () => {
        calls++;
        throw new Error(`fail-${calls}`);
      }, 'k2', { sleep: noSleep, maxAttempts: 3 }),
      /fail-3/
    );
    assert.equal(calls, 3);
  });
  it('does not retry non-retryable errors', async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(async () => {
        calls++;
        throw new Error('401 Unauthorized');
      }, 'k3', { sleep: noSleep }),
      /401/
    );
    assert.equal(calls, 1);
  });
  it('backs off exponentially between attempts', async () => {
    const delays: number[] = [];
    await assert.rejects(
      withRetry(async () => {
        throw new Error('down');
      }, 'k4', { sleep: async (ms) => delays.push(ms), maxAttempts: 3, baseDelayMs: 1000 })
    );
    assert.equal(delays.length, 2);
    // base * 2^0 and base * 2^1, each ±25% jitter.
    assert.ok(delays[0] >= 750 && delays[0] <= 1250, `d0=${delays[0]}`);
    assert.ok(delays[1] >= 1500 && delays[1] <= 2500, `d1=${delays[1]}`);
  });
  it('aborts an attempt that exceeds the timeout', async () => {
    await assert.rejects(
      withRetry(async (_a, _k, signal) => {
        await new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        });
      }, 'k5', { sleep: noSleep, timeoutMs: 20, maxAttempts: 1 }),
      /aborted/
    );
  });
  it('newIdempotencyKey generates unique prefixed keys', () => {
    const a = newIdempotencyKey('stripe');
    const b = newIdempotencyKey('stripe');
    assert.ok(a.startsWith('stripe_'));
    assert.notEqual(a, b);
  });
});
