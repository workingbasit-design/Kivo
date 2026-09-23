import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  googleRedirectUri,
  GOOGLE_TOKEN_URL,
  fetchGoogleAccounts,
} from '@/lib/google-reviews';

/**
 * Google OAuth callback. Verifies the session matches the state (no open
 * redirects — we only ever redirect to our own /reviews page), exchanges
 * the code for tokens, and stores the connection. Location picking happens
 * on the Reviews page afterwards.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!businessId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const error = url.searchParams.get('error');
  if (error) {
    // User denied consent (access_denied) or Google errored — graceful.
    return NextResponse.redirect(new URL('/reviews?google=denied', req.url));
  }

  // State must be this business: prevents completing another account's flow.
  if (url.searchParams.get('state') !== businessId) {
    return NextResponse.redirect(new URL('/reviews?google=invalid-state', req.url));
  }

  const code = url.searchParams.get('code');
  if (!code || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/reviews?google=error', req.url));
  }

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: googleRedirectUri(url.origin),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL('/reviews?google=error', req.url));
    }
    const tokens = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!tokens.access_token) {
      return NextResponse.redirect(new URL('/reviews?google=error', req.url));
    }

    // Best-effort: remember the first Google account id for the reviews call.
    let googleAccountId: string | null = null;
    try {
      const accounts = await fetchGoogleAccounts(tokens.access_token, fetch);
      googleAccountId = accounts[0]?.accountId ?? null;
    } catch {
      googleAccountId = null;
    }

    // Reconnect keeps the previously picked location.
    const prev = await prisma.googleConnection.findUnique({
      where: { businessId },
      select: { locationId: true, locationName: true },
    });
    await prisma.googleConnection.upsert({
      where: { businessId },
      create: {
        businessId,
        googleAccountId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
        scopes: tokens.scope ?? null,
      },
      update: {
        googleAccountId,
        accessToken: tokens.access_token,
        // Only overwrite the refresh token when Google actually returns one.
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        expiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
        scopes: tokens.scope ?? null,
      },
    });
    // Preserve the picked location across reconnects.
    if (prev?.locationId) {
      await prisma.googleConnection.update({
        where: { businessId },
        data: { locationId: prev.locationId, locationName: prev.locationName },
      });
    }

    return NextResponse.redirect(new URL('/reviews?google=connected', req.url));
  } catch {
    return NextResponse.redirect(new URL('/reviews?google=error', req.url));
  }
}
