import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isPublicPath } from '@/lib/public-paths';

// Next.js 16: `proxy.ts` replaces the deprecated `middleware.ts`.
// Lightweight route guard based on the session cookie. Full session
// verification happens in the (app) layout via getSession().
// Public route table lives in @/lib/public-paths (pure, unit-tested).

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('kivo_session');
  const customerCookie = request.cookies.get('kivo_customer_session');

  const isPublic = isPublicPath(pathname);

  // Allow API routes and static assets through (matcher already excludes most)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Customer area: allow with either a customer session or public path.
  // The customer layout/pages enforce customer auth via getCustomerSession().
  const isCustomerRoute = pathname === '/customer' || pathname.startsWith('/customer/');
  if (isCustomerRoute) {
    if (customerCookie || isPublic) {
      return NextResponse.next();
    }
    // No customer session and not a public customer route: send to customer login
    const url = request.nextUrl.clone();
    url.pathname = '/customer/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
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
     * Match all request paths except the static assets in PROXY_STATIC_BYPASS
     * (@/lib/public-paths, unit-tested — keep this literal in sync; Next.js
     * requires matcher entries to be static strings):
     * - _next/static, _next/image (static files)
     * - favicon.ico, favicon.svg, sitemap.xml, robots.txt (metadata)
     * - manifest.webmanifest, sw.js (PWA: browsers fetch these without a session)
     * - og/, icons/, apple-touch-icon.png (public share/PWA assets: social
     *   crawlers fetch og:image with no session; guarding them breaks previews)
     */
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg|sitemap.xml|robots.txt|manifest.webmanifest|sw.js|og/|icons/|apple-touch-icon.png).*)',
  ],
};
