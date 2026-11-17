/**
 * Durable DB-backed rate limiter.
 *
 * Replaces the former in-memory token bucket (deleted in P1.0 S4 P3) so
 * limits hold across Vercel serverless instances and cold starts. Uses the
 * RateLimit table with atomic increment-or-reset.
 *
 * The check is: increment the counter if the window hasn't expired;
 * if no row was updated (missing or expired), reset it. A tiny race
 * exists (two concurrent resets), but the consequence is only a
 * slightly lenient limit - acceptable for rate limiting.
 *
 * Not tenant-scoped by design: keys are "scope:identifier" (IP, user,
 * business) and the table holds no PII beyond the key itself.
 */
import { prisma } from '@/lib/prisma';

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export async function rateLimitDurable(
  key: string,
  opts: { limit: number; windowMs: number }
): Promise<RateLimitResult> {
  // E2E TEST SERVERS ONLY — same three-way gate as the in-memory limiter
  // (P1.0 S5): E2E_DISABLE_RATE_LIMIT=1 + E2E_TEST_SERVER=1 (set only by
  // the Playwright webServer env) + NODE_ENV != 'production'. The
  // Playwright suite logs in hundreds of times against a real server and
  // a real test DB — it cannot stub Prisma, so without this gate the suite
  // would collapse the moment auth swaps to the durable limiter (CI run
  // 43729091950). Vercel always runs production, so the gate is inert there.
  if (
    process.env.E2E_DISABLE_RATE_LIMIT === '1' &&
    process.env.E2E_TEST_SERVER === '1' &&
    process.env.NODE_ENV !== 'production'
  ) {
    return { ok: true, remaining: opts.limit, retryAfterMs: 0 };
  }

  try {
    return await rateLimitDurableDb(key, opts);
  } catch (err) {
    // Fail CLOSED on a DB error for auth buckets (S4): an attacker must
    // never get free attempts because the database is unreachable, and a
    // DB outage already makes login impossible (the user lookup fails),
    // so denying here costs nothing extra. Log so the outage is visible.
    console.error('[rate-limit-durable] DB check failed, denying:', err);
    return { ok: false, remaining: 0, retryAfterMs: opts.windowMs };
  }
}

async function rateLimitDurableDb(
  key: string,
  opts: { limit: number; windowMs: number }
): Promise<RateLimitResult> {
  const now = Date.now();
  const nowDate = new Date(now);

  // Try to increment an unexpired bucket atomically.
  const updated = await prisma.rateLimit.updateMany({
    where: { key, resetAt: { gt: nowDate } },
    data: { count: { increment: 1 } },
  });

  if (updated.count === 0) {
    // Missing or expired - (re)create the bucket.
    const resetAt = new Date(now + opts.windowMs);
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, resetAt },
      update: { count: 1, resetAt },
    });
    return { ok: true, remaining: opts.limit - 1, retryAfterMs: 0 };
  }

  // Bucket was incremented; check the new count.
  const record = await prisma.rateLimit.findUnique({
    where: { key },
    select: { count: true, resetAt: true },
  });

  if (!record) {
    // Extremely unlikely (deleted between update and read); allow.
    return { ok: true, remaining: opts.limit - 1, retryAfterMs: 0 };
  }

  if (record.count > opts.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(0, record.resetAt.getTime() - now),
    };
  }

  return {
    ok: true,
    remaining: opts.limit - record.count,
    retryAfterMs: 0,
  };
}

/**
 * Delete expired buckets. Called from a cron; keeps the table small.
 * Safe to run concurrently - deleteMany is idempotent.
 */
export async function pruneRateLimits(): Promise<number> {
  const result = await prisma.rateLimit.deleteMany({
    where: { resetAt: { lt: new Date() } },
  });
  return result.count;
}

/** Presets (same values as the former in-memory limiter). */
export const AUTH_LIMIT = { limit: 8, windowMs: 10 * 60 * 1000 };
export const ACTION_LIMIT = { limit: 120, windowMs: 60 * 1000 };
export const QUOTE_REQUEST_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };
export const REPORT_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };
