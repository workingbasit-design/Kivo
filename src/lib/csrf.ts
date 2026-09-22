import { NextResponse } from 'next/server';

/**
 * CSRF / origin audit helper for API routes.
 *
 * Findings (empirically verified 2026-09-22 on the Next.js 16.3.5 dev
 * server, port 3100):
 * - Server actions: Next.js itself rejects cross-origin action calls. A
 *   forged POST (Origin: https://evil.example.com) to a real action
 *   endpoint returned 500 "Invalid Server Actions request." and the action
 *   did NOT run (server log: "`x-forwarded-host` ... does not match
 *   `origin` ... Aborting the action."), while the same request with a
 *   same-origin Origin succeeded. Requests with NO Origin header are let
 *   through with a warning (handcrafted/curl) — fine, since CSRF requires
 *   a browser that always sends Origin cross-origin. SameSite=lax cookies
 *   add a second layer. Verdict: framework-protected; no app change needed.
 * - API routes (`src/app/api/**`): Next.js enforces NOTHING about origin —
 *   verified: POST /api/copilot with Origin: https://evil.example.com and
 *   a valid session cookie returned 200 and was fully processed. So every
 *   mutating API route must do its own origin check (this helper).
 *
 * Usage in a route handler:
 *
 *   import { checkSameOrigin, originForbidden } from '@/lib/csrf';
 *
 *   export async function POST(req: NextRequest) {
 *     const originCheck = checkSameOrigin(req);
 *     if (!originCheck.ok) return originForbidden();
 *     ...
 *   }
 *
 * Policy:
 * - Same-origin (Origin or Referer matches the request's own origin) -> allow.
 * - Both Origin and Referer absent (curl, server-to-server, native clients)
 *   -> allow. These clients can't be CSRF'd via a browser.
 * - Origin and/or Referer present but neither matches the request origin
 *   -> reject (classic CSRF).
 *
 * A note on "same-origin": we compare against the request's own Host
 * (derived from the Host / X-Forwarded-Host header), which is what a legit
 * same-origin browser request carries. If the app is served behind a proxy
 * under a different public host, pass that host via `allowedHosts`.
 */

export interface OriginCheck {
  ok: boolean;
  /** Present only when !ok. */
  reason?: string;
}

function requestOrigins(req: Request): { origin: string | null; referer: string | null } {
  return {
    origin: req.headers.get('origin'),
    referer: req.headers.get('referer'),
  };
}

function hostFromHeaders(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-host');
  if (forwarded) return forwarded.split(',')[0].trim().toLowerCase();
  const host = req.headers.get('host');
  return host ? host.trim().toLowerCase() : null;
}

function originHost(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

export function checkSameOrigin(
  req: Request,
  opts: { allowedHosts?: string[] } = {}
): OriginCheck {
  const { origin, referer } = requestOrigins(req);

  // Non-browser clients send neither header — nothing to verify, allow.
  if (!origin && !referer) return { ok: true };

  const allowed = new Set<string>();
  const selfHost = hostFromHeaders(req);
  if (selfHost) allowed.add(selfHost);
  for (const h of opts.allowedHosts ?? []) allowed.add(h.toLowerCase());

  const candidates = [origin, referer]
    .map((v) => (v ? originHost(v) : null))
    .filter((h): h is string => h !== null);

  // A header we couldn't parse is suspicious — fail closed.
  const unparsable = [origin, referer].some((v) => v !== null && originHost(v) === null);
  if (unparsable) {
    return { ok: false, reason: 'Unparseable Origin/Referer header' };
  }

  const matched = candidates.some((h) => allowed.has(h));
  if (!matched) {
    return {
      ok: false,
      reason: `Origin/Referer mismatch: got ${candidates.join(', ') || 'none'}, expected ${[...allowed].join(', ') || 'self'}`,
    };
  }

  return { ok: true };
}

/** Standard 403 JSON response for a failed origin check. */
export function originForbidden(reason?: string): NextResponse {
  return NextResponse.json(
    { error: 'Forbidden: cross-origin request rejected.', ...(reason ? { detail: reason } : {}) },
    { status: 403 }
  );
}
