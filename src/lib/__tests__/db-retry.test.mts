/**
 * Unit tests for the database retry wrapper (src/lib/db-retry.ts).
 * Hermetic: the "database" is a stubbed async function, sleeps are
 * injected no-ops, randomness is stubbed. No network, no real Prisma
 * client needed — but the error shapes use the real @prisma/client error
 * classes so the retry classifier is tested for real.
 * Run: node --test src/lib/__tests__/db-retry.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { withDbRetry, retryDelayMs } from '../db-retry.ts';
import { isDatabaseUnavailable } from '../db-errors.ts';

const CLIENT_VERSION = '5.22.0';

function tooManyConnections() {
  return new Prisma.PrismaClientInitializationError(
    'Too many database connections opened: FATAL: too many connections for role "prisma_migration"',
    CLIENT_VERSION,
  );
}

function poolTimeout() {
  return new Prisma.PrismaClientKnownRequestError('Timed out fetching a new connection from the connection pool', {
    code: 'P2024',
    clientVersion: CLIENT_VERSION,
  });
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: CLIENT_VERSION,
  });
}

function harness() {
  const sleeps: number[] = [];
  let calls = 0;
  return {
    sleeps,
    calls: () => calls,
    track: () => {
      calls += 1;
    },
    sleepFn: async (ms: number) => {
      sleeps.push(ms);
    },
    random: () => 0,
  };
}

// ── classifier ────────────────────────────────────────────────────────

test('isDatabaseUnavailable: pool exhaustion and pool timeout are retryable', () => {
  assert.equal(isDatabaseUnavailable(tooManyConnections()), true);
  assert.equal(isDatabaseUnavailable(poolTimeout()), true);
});

test('isDatabaseUnavailable: app errors are not retryable', () => {
  assert.equal(isDatabaseUnavailable(new Error('boom')), false);
  assert.equal(isDatabaseUnavailable(uniqueViolation()), false);
});

// ── backoff ───────────────────────────────────────────────────────────

test('retryDelayMs grows exponentially with bounded jitter', () => {
  assert.equal(retryDelayMs(1, () => 0), 400);
  assert.equal(retryDelayMs(2, () => 0), 800);
  assert.ok(retryDelayMs(1, () => 0.999) < 600);
  assert.ok(retryDelayMs(2, () => 0.999) < 1000);
});

// ── withDbRetry ───────────────────────────────────────────────────────

test('withDbRetry returns on first success without sleeping', async () => {
  const h = harness();
  const result = await withDbRetry(async () => {
    h.track();
    return 'ok';
  }, h);
  assert.equal(result, 'ok');
  assert.equal(h.calls(), 1);
  assert.deepEqual(h.sleeps, []);
});

test('withDbRetry retries pool-exhaustion failures then succeeds', async () => {
  const h = harness();
  let n = 0;
  const result = await withDbRetry(
    async () => {
      h.track();
      n += 1;
      if (n < 3) throw tooManyConnections();
      return 'recovered';
    },
    h,
  );
  assert.equal(result, 'recovered');
  assert.equal(h.calls(), 3);
  assert.equal(h.sleeps.length, 2);
  assert.equal(h.sleeps[0], 400);
  assert.equal(h.sleeps[1], 800);
});

test('withDbRetry retries P2024 pool timeouts', async () => {
  const h = harness();
  let n = 0;
  const result = await withDbRetry(
    async () => {
      h.track();
      n += 1;
      if (n < 2) throw poolTimeout();
      return 'recovered';
    },
    h,
  );
  assert.equal(result, 'recovered');
  assert.equal(h.calls(), 2);
});

test('withDbRetry does not retry application errors', async () => {
  const h = harness();
  await assert.rejects(
    withDbRetry(async () => {
      h.track();
      throw uniqueViolation();
    }, h),
    /Unique constraint failed/,
  );
  assert.equal(h.calls(), 1);
  assert.deepEqual(h.sleeps, []);
});

test('withDbRetry gives up after max attempts and rethrows', async () => {
  const h = harness();
  await assert.rejects(
    withDbRetry(
      async () => {
        h.track();
        throw tooManyConnections();
      },
      { ...h, maxAttempts: 3 },
    ),
    /Too many database connections/,
  );
  assert.equal(h.calls(), 3);
  assert.equal(h.sleeps.length, 2);
});
