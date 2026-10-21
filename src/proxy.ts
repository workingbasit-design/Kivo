import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isPublicPath, isMapPath } from '@/lib/public-paths';

// Next.js 16: `proxy.ts` replaces the deprecated `middleware.ts`.
// Lightweight route guard based on the session cookie. Full session
// verification happens in the (app) layout via getSession().
// Public route table lives in @/lib/public-paths (pure, unit-tested).

/**
 * Nonce-based Content-Security-Policy (Prompt 3, B2.1).
 *
 * A per-request nonce is generated here, stamped on the `x-nonce` request
 * header (server components read it via `headers()` → `@/lib/csp-nonce` and
 * put it on the app's inline scripts), and enforced through the
 * Content-Security-Policy response header.
 *
 * Policy notes:
 * - script-src is nonce-only (no 'unsafe-inline'): the app's inline scripts
 *   carry the nonce; Next.js framework scripts are covered by the
 *   framework's own handling of the x-nonce request header.
 * - style-src keeps 'unsafe-inline': React SSR emits `style=""` attributes
 *   and CSP nonces do not apply to style attributes - a nonce-only
 *   style-src would break rendering. Standard trade-off for React apps.
 * - frame-ancestors 'none' (B2.2 decision): stricter wins; the booking-page
 *   embedding idea is not a live feature.
 * - Map allowance (D3b, 2026-10-21): the live map (DispatcherMap) loads
 *   Leaflet 1.9.4 JS/CSS from unpkg.com and tiles from
 *   tile.openstreetmap.org. img-src/connect-src already allow https:, so
 *   tiles pass everywhere; but the global script-src/style-src blocked
 *   the library itself, so the map could NEVER render ("Map unavailable"
 *   in every browser). The unpkg allowance is scoped to the only two
 *   surfaces that render a map — /tracking and /track/<token>
 *   (isMapPath in @/lib/public-paths) — so the nonce-only policy stays
 *   in force for the rest of the app.
 *
 * Staging gate (per plan): the full manual QA pass must run against staging
 * before this is considered verified. If inline scripts break, fix the nonce
 * plumbing - never weaken to 'unsafe-inline'.
 */
function buildCsp(nonce: string, pathname: string): string {
  const mapAllowance = isMapPath(pathname) ? ' https://unpkg.com' : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${mapAllowance}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com${mapAllowance}`,
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' blob: data: https:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

/**
 * Attach the CSP headers to a response. For `NextResponse.next()` the nonce
 * is also forwarded on the request headers so downstream server components
 * can read it; for redirects/responses the CSP header alone is enough.
 */
function withCsp(response: NextResponse, nonce: string, pathname: string): NextResponse {
  response.headers.set('Content-Security-Policy', buildCsp(nonce, pathname));
  response.headers.set('x-nonce', nonce);
  return response;
}

/** NextResponse.next() with the CSP nonce forwarded on the request headers. */
function nextWithNonce(request: NextRequest, nonce: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('kivo_session');
  const customerCookie = request.cookies.get('kivo_customer_session');

  const isPublic = isPublicPath(pathname);
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // Allow API routes and static assets through (matcher already excludes most)
  if (pathname.startsWith('/api/')) {
    return withCsp(NextResponse.next(), nonce, pathname);
  }

  // Customer area: allow with either a customer session or public path.
  // The customer layout/pages enforce customer auth via getCustomerSession().
  const isCustomerRoute = pathname === '/customer' || pathname.startsWith('/customer/');
  if (isCustomerRoute) {
    if (customerCookie || isPublic) {
      return withCsp(nextWithNonce(request, nonce), nonce, pathname);
    }
    // No customer session and not a public customer route: send to customer login
    const url = request.nextUrl.clone();
    url.pathname = '/customer/login';
    url.searchParams.set('next', pathname);
    return withCsp(NextResponse.redirect(url), nonce, pathname);
  }

  if (!sessionCookie && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return withCsp(NextResponse.redirect(url), nonce, pathname);
  }

  // NOTE (2026-09-26): there used to be a redirect here sending anyone
  // WITH a kivo_session cookie from /login or /register to /dashboard.
  // It keyed off the mere PRESENCE of the cookie without validating the
  // session, so a stale/invalid cookie caused an unbreakable loop:
  // /login -> /dashboard (proxy) -> /login ((app) layout, session invalid).
  // The user could never reach the login form to sign in again. Removed.
  // Authenticated users are bounced to /dashboard by the (auth) layout
  // below, which only redirects on a fully validated session.

  return withCsp(nextWithNonce(request, nonce), nonce, pathname);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except the static assets in PROXY_STATIC_BYPASS
     * (@/lib/public-paths, unit-tested - keep this literal in sync; Next.js
     * requires matcher entries to be static strings):
     * - _next/static, _next/image (static files)
     * - favicon.ico, favicon.svg, sitemap.xml, robots.txt (metadata)
     * - manifest.webmanifest, sw.js (PWA: browsers fetch these without a session)
     * - og/, icons/, apple-touch-icon.png (public share/PWA assets: social
     *   crawlers fetch og:image with no session; guarding them breaks previews)
     * - skills/ (Agent Protocol skill files under public/skills, one
     *   SKILL.md per skill: advertised in the public manifest, fetched by
     *   agents with no session)
     */
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg|sitemap.xml|robots.txt|manifest.webmanifest|sw.js|og/|icons/|apple-touch-icon.png|skills/).*)',
  ],
};
