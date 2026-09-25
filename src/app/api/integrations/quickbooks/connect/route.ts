import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { rateLimit, AUTH_LIMIT } from '@/lib/rate-limit';
import { buildAuthorizeUrl } from '@/lib/quickbooks';
import crypto from 'crypto';

export const QB_STATE_COOKIE = 'qb_oauth_state';

/** Intuit app credentials must be configured by the owner (free developer app). */
export function quickbooksConfigured(): boolean {
  return Boolean(process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET);
}

export function quickbooksRedirectUri(origin: string): string {
  return `${origin}/api/integrations/quickbooks/callback`;
}

/**
 * GET /api/integrations/quickbooks/connect — start Intuit OAuth2.
 * Without configured credentials we bounce back to settings with a code the
 * card turns into the 3-step setup instructions (graceful, $0 spend).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const session = await getSession();
  if (!session?.user?.businessId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const rl = rateLimit(`qb-connect:${ip}`, AUTH_LIMIT);
  if (!rl.ok) {
    return NextResponse.redirect(new URL('/settings?quickbooks=rate-limited', req.url));
  }

  if (!quickbooksConfigured()) {
    return NextResponse.redirect(new URL('/settings?quickbooks=not-configured', req.url));
  }

  const state = crypto.randomBytes(16).toString('hex');
  const authorizeUrl = buildAuthorizeUrl({
    clientId: process.env.QUICKBOOKS_CLIENT_ID as string,
    redirectUri: quickbooksRedirectUri(url.origin),
    state,
  });
  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(QB_STATE_COOKIE, state, {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    path: '/api/integrations/quickbooks/callback',
    maxAge: 600, // 10 minutes to finish the Intuit consent screen
  });
  return res;
}
