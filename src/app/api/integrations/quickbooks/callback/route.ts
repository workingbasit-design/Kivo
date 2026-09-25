import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, AUTH_LIMIT } from '@/lib/rate-limit';
import { exchangeCode } from '@/lib/quickbooks';
import { QB_STATE_COOKIE, quickbooksConfigured, quickbooksRedirectUri } from '../connect/route';

/**
 * GET /api/integrations/quickbooks/callback — Intuit OAuth2 callback.
 * Verifies state (CSRF), exchanges the code, and stores the per-business
 * connection. The company id (realmId) arrives as its own query param.
 * No open redirects — we only ever redirect to /settings.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!businessId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const rl = rateLimit(`qb-callback:${ip}`, AUTH_LIMIT);
  if (!rl.ok) {
    return NextResponse.redirect(new URL('/settings?quickbooks=rate-limited', req.url));
  }

  const denied = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/settings?quickbooks=${reason}`, req.url));
    res.cookies.set(QB_STATE_COOKIE, '', { path: '/api/integrations/quickbooks/callback', maxAge: 0 });
    return res;
  };

  if (!quickbooksConfigured()) return denied('not-configured');
  if (url.searchParams.get('error')) return denied('denied'); // user cancelled on Intuit

  const state = url.searchParams.get('state');
  const jar = await cookies();
  const cookieState = jar.get(QB_STATE_COOKIE)?.value;
  if (!state || !cookieState || state !== cookieState) {
    return denied('invalid-state');
  }

  const code = url.searchParams.get('code');
  const realmId = url.searchParams.get('realmId');
  if (!code || !realmId) return denied('error');

  try {
    const tokens = await exchangeCode(
      code,
      quickbooksRedirectUri(url.origin),
      process.env.QUICKBOOKS_CLIENT_ID as string,
      process.env.QUICKBOOKS_CLIENT_SECRET as string
    );
    if (!tokens.ok || !tokens.accessToken || !tokens.refreshToken) {
      return denied('error');
    }
    await prisma.quickBooksConnection.upsert({
      where: { businessId },
      create: {
        businessId,
        realmId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + (tokens.expiresIn ?? 3600) * 1000),
      },
      update: {
        realmId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + (tokens.expiresIn ?? 3600) * 1000),
        lastSyncAt: null, // fresh connection — nothing synced yet
      },
    });
    const ok = NextResponse.redirect(new URL('/settings?quickbooks=connected', req.url));
    ok.cookies.set(QB_STATE_COOKIE, '', { path: '/api/integrations/quickbooks/callback', maxAge: 0 });
    return ok;
  } catch {
    return denied('error');
  }
}
