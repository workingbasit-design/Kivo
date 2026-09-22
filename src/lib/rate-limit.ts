/**
 * Tiny in-memory token-bucket rate limiter.
 * Good enough for a single-instance deployment (SQLite-backed app).
 * For multi-instance deployments, replace with Redis/Upstash.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Prune old buckets every 5 minutes so the map can't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) {
    if (b.resetAt < now) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): { ok: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.limit - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= opts.limit) {
    return { ok: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { ok: true, remaining: opts.limit - bucket.count, retryAfterMs: 0 };
}

/** Presets */
export const AUTH_LIMIT = { limit: 8, windowMs: 10 * 60 * 1000 }; // 8 attempts / 10 min
export const ACTION_LIMIT = { limit: 120, windowMs: 60 * 1000 }; // 120 actions / min
export const QUOTE_REQUEST_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }; // 5 quote requests / hour / IP (public, spam-prone)
export const REPORT_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }; // 5 business reports / hour / IP
