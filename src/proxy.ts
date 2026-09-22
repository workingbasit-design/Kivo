import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16: `proxy.ts` replaces the deprecated `middleware.ts`.
// Lightweight route guard based on the session cookie. Full session
// verification happens in the (app) layout via getSession().

const PUBLIC_PATHS = ['/', '/login', '/register'];
// Public client-facing routes: online booking + magic-link portals (unguessable ids)
// + the Kivo business directory (customer discovery layer).
const PUBLIC_PREFIXES = ['/book/', '/q/', '/i/', '/r/', '/p/'];
const PUBLIC_EXACT_EXTRA = ['/directory', '/directory/request'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('kivo_session');

  const isPublic =
    PUBLIC_PATHS.some(
      (p) => pathname === p || pathname.startsWith('/api/copilot')
    ) ||
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

  if (sessionCookie && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (static files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
