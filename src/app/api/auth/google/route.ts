import { NextResponse } from 'next/server';
import { googleOAuthConfigured } from '@/lib/google-reviews';
import {
  buildGoogleSignInUrl,
  randomOAuthValue,
  safeRedirectPath,
} from '@/lib/google-auth';
import { rateLimit, AUTH_LIMIT } from '@/lib/rate-limit';

const STATE_COOKIE = 'google_oauth_state';

function clientIp(req: Request): string {
  const h = (req as unknown as { headers: Headers }).headers;
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  );
}

/**
 * Start "Continue with Google": generate a secure random state + nonce,
 * stash them in a short-lived httpOnly cookie, and redirect to Google.
 * Optional ?returnTo= must be a same-origin path (open-redirect guard).
 */
export async function GET(req: Request) {
  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(new URL('/login?google=not-configured', req.url));
  }

  // Rate-limit OAuth initiations per IP — prevents state-cookie churn attacks.
  const rl = rateLimit(`google-oauth-init:${clientIp(req)}`, AUTH_LIMIT);
  if (!rl.ok) {
    return NextResponse.redirect(new URL('/login?google=rate-limited', req.url));
  }

  const url = new URL(req.url);
  const origin = url.origin;
  const returnTo = safeRedirectPath(url.searchParams.get('returnTo'));

  const state = randomOAuthValue();
  const nonce = randomOAuthValue();

  const authUrl = buildGoogleSignInUrl({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    redirectUri: `${origin.replace(/\/$/, '')}/api/auth/google/callback`,
    state,
    nonce,
  });

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(STATE_COOKIE, JSON.stringify({ state, nonce, returnTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/google',
    maxAge: 600, // 10 minutes — enough to complete the Google round trip
  });
  return res;
}
