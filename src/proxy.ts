import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16: `proxy.ts` replaces the deprecated `middleware.ts`.
// Lightweight route guard based on the session cookie. Full session
// verification happens in the (app) layout via getSession().

const PUBLIC_PATHS = ['/', '/login', '/register'];
// Public client-facing routes: online booking + magic-link portals (unguessable ids)
// + the EveryJob business directory (customer discovery layer).
// '/sign/' must stay public: unauthenticated clients open signing links
// with no login, and bouncing them to /login would break the feature.
// '/track/' must stay public: customers open technician tracking links
// with no account — the unguessable token is the only capability.
const PUBLIC_PREFIXES = ['/book/', '/q/', '/i/', '/r/', '/p/', '/portal/', '/sign/', '/track/'];
const PUBLIC_EXACT_EXTRA = ['/directory', '/directory/request'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('kivo_session');

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p) ||
    PUBLIC_EXACT_EXTRA.some((p) => pathname === p) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  // Allow API routes and static assets through (matcher already excludes most)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (!sessionCookie && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // NOTE (2026-09-26): there used to be a redirect here sending anyone
  // WITH a kivo_session cookie from /login or /register to /dashboard.
  // It keyed off the mere PRESENCE of the cookie without validating the
  // session, so a stale/invalid cookie caused an unbreakable loop:
  // /login -> /dashboard (proxy) -> /login ((app) layout, session invalid).
  // The user could never reach the login form to sign in again. Removed.
  // Authenticated users are bounced to /dashboard by the (auth) layout
  // below, which only redirects on a fully validated session.

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (static files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata)
     * - manifest.webmanifest, sw.js (PWA: browsers fetch these without a session)
     * - og/, icons/, apple-touch-icon.png (public share/PWA assets: social
     *   crawlers fetch og:image with no session; guarding them breaks previews)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|sw.js|og/|icons/|apple-touch-icon.png).*)',
  ],
};
