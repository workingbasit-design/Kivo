/**
 * Best-effort client IP extraction for rate limiting and abuse logging.
 *
 * Trust order (per Vercel docs, https://vercel.com/docs/headers/request-headers):
 *  1. `x-vercel-forwarded-for` — set by Vercel's edge; identical to
 *     x-forwarded-for but NOT clobbered when another proxy sits on top of
 *     Vercel. This is the platform-verified value: prefer it.
 *  2. `x-forwarded-for` — Vercel OVERWRITES this header and does not forward
 *     external values, specifically to prevent IP spoofing. On Vercel the
 *     value is the real client IP, so reading it is safe. Off Vercel
 *     (local dev) it may be a proxy chain; we take the leftmost entry,
 *     which is the dev-proxy convention.
 *  3. `x-real-ip` — per Vercel docs, identical to x-forwarded-for.
 *  4. `'unknown'`.
 *
 * We never invent trust: a header only counts when the platform sets it.
 * If this app ever moves off Vercel behind an untrusted proxy, the trust
 * order here must be revisited — the leftmost x-forwarded-for entry is
 * attacker-controlled in that setup.
 */

function firstIp(value: string | null): string | null {
  if (!value) return null;
  const ip = value.split(',')[0]?.trim();
  return ip || null;
}

/** Extract the client IP from a Headers object (route handlers + server actions). */
export function clientIpFromHeaders(h: Headers): string {
  return (
    firstIp(h.get('x-vercel-forwarded-for')) ??
    firstIp(h.get('x-forwarded-for')) ??
    firstIp(h.get('x-real-ip')) ??
    'unknown'
  );
}
