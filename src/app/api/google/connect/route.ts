import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getSession } from '@/lib/auth';
import {
  googleOAuthConfigured,
  googleRedirectUri,
  buildAuthUrl,
  googleScopes,
} from '@/lib/google-reviews';

/** Cookie binding the OAuth round trip to the browser that started it. */
export const GOOGLE_BP_STATE_COOKIE = 'google_bp_oauth_state';

/**
 * Start Google OAuth: redirect the business owner to Google's consent
 * screen. Uses a random state stored in a short-lived HttpOnly cookie
 * (CSRF protection) — the callback also verifies the session's business.
 */
export async function GET(req: Request) {
  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!businessId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(new URL('/reviews?google=not-configured', req.url));
  }

  const state = randomBytes(32).toString('base64url');
  const origin = new URL(req.url).origin;
  const url = buildAuthUrl({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    redirectUri: googleRedirectUri(origin),
    state,
    scopes: googleScopes(),
  });

  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_BP_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/google/callback',
    maxAge: 600, // 10 minutes — enough to complete the Google round trip
  });
  return res;
}
