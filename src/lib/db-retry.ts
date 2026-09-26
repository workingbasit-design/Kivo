/**
 * Retry wrapper for database operations.
 *
 * Production (2026-09-26) showed that the Postgres role EveryJob connects
 * with ("prisma_migration") has a very small connection cap. During bursts —
 * deploy cold starts, rapid taps on a phone — Vercel spins up concurrent
 * serverless instances and the role rejects new connections with
 * "FATAL: too many connections for role". Each instance already opens only
 * one pooled connection, so the remaining lever is resilience: when the
 * database is momentarily unreachable, wait briefly and try again instead
 * of immediately 500ing.
 *
 * Safety: only errors classified by isDatabaseUnavailable() are retried.
 * Those all happen BEFORE the query executes (engine init / connection
 * acquisition / pool checkout), so a retried write cannot double-apply —
 * the first attempt never reached the database.
 */
import { isDatabaseUnavailable } from './db-errors.ts';

const MAX_ATTEMPTS = 3; // 1 initial try + 2 retries
const BASE_DELAY_MS = 400;
const JITTER_MS = 200;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with jitter: ~400ms, ~800ms, ... */
export function retryDelayMs(failedAttempt: number, random: () => number = Math.random): number {
  return BASE_DELAY_MS * 2 ** (failedAttempt - 1) + random() * JITTER_MS;
}

export interface RetryOptions {
  maxAttempts?: number;
  sleepFn?: (ms: number) => Promise<void>;
  random?: () => number;
}

export async function withDbRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  const sleepFn = opts.sleepFn ?? sleep;
  const random = opts.random ?? Math.random;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      attempt += 1;
      if (attempt >= maxAttempts || !isDatabaseUnavailable(e)) throw e;
      await sleepFn(retryDelayMs(attempt, random));
    }
  }
}
