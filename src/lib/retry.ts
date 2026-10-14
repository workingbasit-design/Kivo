/**
 * Safe retries with idempotency (Prompt 3, B10.3).
 *
 * `withRetry()` wraps Stripe/email/SMS/AI calls: configurable timeout,
 * exponential backoff (max 3 attempts), and an idempotency key threaded
 * through every attempt so a retry can never double-apply a side effect.
 * The key is passed to the operation, which must forward it to the provider
 * (Stripe-Idempotency-Key, Resend idempotency key, or our own
 * IdempotencyKey table for AI calls).
 *
 * Pure except for timers; runs under plain node:test with injected sleep.
 */
import { randomBytes } from 'node:crypto';
export interface RetryOptions {
  maxAttempts?: number; // default 3
  baseDelayMs?: number; // default 500; backoff is base * 2^attempt + jitter
  timeoutMs?: number; // default 10_000; per-attempt AbortSignal timeout
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Return true when the error must NOT be retried (e.g. 4xx, auth). */
  isRetryable?: (err: unknown) => boolean;
}

export interface RetryOperation {
  (attempt: number, idempotencyKey: string, signal: AbortSignal): Promise<unknown>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultIsRetryable(err: unknown): boolean {
  // Non-retryable: auth failures, validation errors, explicit aborts.
  const msg = err instanceof Error ? err.message : String(err);
  if (/401|403|unauthorized|forbidden|invalid|validation|bad request/i.test(msg)) return false;
  return true;
}

/**
 * Run `op` with timeout + exponential-backoff retries. The same
 * `idempotencyKey` is passed to every attempt. Resolves with the first
 * success; rejects with the last error after maxAttempts.
 */
export async function withRetry(
  op: RetryOperation,
  idempotencyKey: string,
  opts: RetryOptions = {}
): Promise<unknown> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const sleep = opts.sleep ?? defaultSleep;
  const isRetryable = opts.isRetryable ?? defaultIsRetryable;

  let lastError: unknown = new Error('withRetry: no attempts made');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const result = await op(attempt, idempotencyKey, ctrl.signal);
      clearTimeout(timer);
      return result;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (!isRetryable(err) || attempt === maxAttempts) break;
      // Exponential backoff with jitter: base * 2^(attempt-1), ±25%.
      const backoff = baseDelayMs * 2 ** (attempt - 1);
      const jitter = backoff * 0.25 * (Math.random() * 2 - 1);
      await sleep(Math.max(0, Math.round(backoff + jitter)));
    }
  }
  throw lastError;
}

/** Generate an idempotency key for one logical operation. */
export function newIdempotencyKey(prefix = 'op'): string {
  return `${prefix}_${randomBytes(16).toString('hex')}`;
}
