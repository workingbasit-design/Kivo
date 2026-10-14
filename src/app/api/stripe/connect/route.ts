import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSession } from '@/lib/auth';
import { getActiveMembershipForUser } from '@/lib/membership';
import { connectOAuthUrl } from '@/lib/stripe';

const STATE_COOKIE = 'stripe_oauth_state';

function baseUrl(req: Request): string {
  return process.env.APP_BASE_URL ?? new URL(req.url).origin;
}

/**
 * Start Stripe Connect OAuth for the signed-in business. The CSRF `state`
 * is random per attempt, stored in an HttpOnly SameSite cookie, and verified
 * (then deleted) in the callback. We only ever redirect to Stripe or to our
 * own settings page - no open redirects.
 */
export async function GET(req: Request) {
  const session = await getSession();
  const membership = session ? await getActiveMembershipForUser(session.user.id) : null;
  const businessId = membership?.businessId;
  if (!businessId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (!process.env.STRIPE_CLIENT_ID || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.redirect(
      new URL('/settings/payments?stripe=not-configured', req.url)
    );
  }

  // B7.4: owners must enable TOTP two-factor authentication before they can
  // connect payments. (The check is on the OWNER role specifically.)
  if (membership.role === 'OWNER' && session && !session.user.totpEnabled) {
    return NextResponse.redirect(new URL('/settings/security?totp=required', req.url));
  }

  const state = randomBytes(24).toString('hex');
  const redirectUri = `${baseUrl(req)}/api/stripe/callback`;
  const url = connectOAuthUrl({
    clientId: process.env.STRIPE_CLIENT_ID,
    redirectUri,
    state,
  });

  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });
  return res;
}
