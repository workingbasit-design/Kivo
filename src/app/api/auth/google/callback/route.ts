import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/auth';
import { googleOAuthConfigured } from '@/lib/google-reviews';
import {
  exchangeCodeForTokens,
  verifyGoogleIdToken,
  resolveGoogleAccount,
  safeRedirectPath,
} from '@/lib/google-auth';
import { rateLimit, AUTH_LIMIT } from '@/lib/rate-limit';
import { clientIpFromHeaders } from '@/lib/client-ip';

const STATE_COOKIE = 'google_oauth_state';

function loginRedirect(req: Request, code: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?google=${code}`, req.url));
}

/**
 * Google sign-in callback.
 * 1. Verify the state matches the cookie we set (CSRF protection).
 * 2. Exchange the code, then verify the ID token signature + claims
 *    (issuer, audience, expiry, nonce, verified email).
 * 3. Resolve the account: existing googleId → log in; verified-email match
 *    → link googleId and log in (never a duplicate); otherwise create a
 *    fresh Canadian business tenant + owner, same as password signup.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;

  // Rate-limit the callback per IP — same budget as password auth.
  const ip = clientIpFromHeaders(req.headers);
  const rl = rateLimit(`google-callback:${ip}`, AUTH_LIMIT);
  if (!rl.ok) return loginRedirect(req, 'rate-limited');

  if (!googleOAuthConfigured()) return loginRedirect(req, 'not-configured');

  if (url.searchParams.get('error')) {
    return loginRedirect(req, 'denied');
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const store = await cookies();
  const raw = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  let saved: { state?: string; nonce?: string; returnTo?: string } = {};
  try {
    saved = raw ? JSON.parse(raw) : {};
  } catch {
    saved = {};
  }
  if (!code || !state || !saved.state || state !== saved.state || !saved.nonce) {
    return loginRedirect(req, 'session-mismatch');
  }

  const exchanged = await exchangeCodeForTokens({
    code,
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: `${origin.replace(/\/$/, '')}/api/auth/google/callback`,
  });
  if (!exchanged.ok) return loginRedirect(req, 'token-exchange');

  const verified = await verifyGoogleIdToken({
    idToken: exchanged.idToken,
    clientId: process.env.GOOGLE_CLIENT_ID!,
    expectedNonce: saved.nonce,
  });
  if (!verified.ok) {
    return loginRedirect(req, verified.error === 'email_unverified' ? 'email-unverified' : 'verify-failed');
  }
  const claims = verified.claims;

  const byGoogleId = claims.sub
    ? await prisma.user.findUnique({ where: { googleId: claims.sub }, select: { id: true } })
    : null;
  const byEmail = await prisma.user.findUnique({
    where: { email: claims.email.toLowerCase() },
    select: { id: true, businessId: true },
  });

  const resolution = resolveGoogleAccount(claims, byGoogleId, byEmail);
  const returnTo = safeRedirectPath(saved.returnTo);

  if (resolution.action === 'login' || resolution.action === 'link') {
    if (resolution.action === 'link') {
      // Verified-email link: attach this Google identity to the existing
      // account instead of creating a duplicate.
      await prisma.user.update({
        where: { id: resolution.userId },
        data: { googleId: claims.sub },
      });
    }
    await createSession(resolution.userId);
    return NextResponse.redirect(new URL(returnTo, req.url));
  }

  if (resolution.action === 'error') {
    return loginRedirect(req, 'email-unverified');
  }

  // Fresh Google user: same Canadian business-tenant setup as password signup.
  const email = claims.email.toLowerCase();
  const name = claims.name?.trim() || email.split('@')[0];
  const business = await prisma.business.create({
    data: {
      name,
      regionCode: 'CA',
      currency: 'CAD',
      timezone: 'America/Toronto',
      users: {
        create: {
          name,
          email,
          // Unusable password: this account signs in via Google only.
          // 64 random bytes through bcrypt so no password can ever match.
          passwordHash: await bcrypt.hash(
            `google-only:${crypto.randomUUID()}:${Date.now()}`,
            12
          ),
          role: 'ADMIN',
          googleId: claims.sub,
        },
      },
    },
    include: { users: true },
  });

  const owner = business.users[0];
  await createSession(owner.id);
  // New Google users are asked for a Canadian contact number (skippable).
  return NextResponse.redirect(new URL('/welcome', req.url));
}
