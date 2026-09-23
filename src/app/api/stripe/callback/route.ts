import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { exchangeConnectCode, getConnectAccountStatus } from '@/lib/stripe';

const STATE_COOKIE = 'stripe_oauth_state';

/**
 * Stripe Connect OAuth callback. Verifies the random state, exchanges the
 * code for the connected account id, and stores the connection. Funds settle
 * directly to the business's Stripe account — EveryJob never holds money.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/settings/payments?stripe=${reason}`, req.url));

  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!businessId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (url.searchParams.get('error')) return fail('denied');

  const state = url.searchParams.get('state');
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;
  // Delete the cookie immediately (single-use).
  const clearCookie = (res: NextResponse) => {
    res.cookies.set(STATE_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
    return res;
  };
  if (!state || !cookieState || state !== cookieState) {
    return clearCookie(fail('invalid-state'));
  }

  const code = url.searchParams.get('code');
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!code || !secret) return clearCookie(fail('error'));

  const exchanged = await exchangeConnectCode(code, secret);
  if (!exchanged.ok || !exchanged.stripeUserId) {
    return clearCookie(fail('error'));
  }

  const status = await getConnectAccountStatus(secret, exchanged.stripeUserId);

  await prisma.stripeConnection.upsert({
    where: { businessId },
    create: {
      businessId,
      stripeAccountId: exchanged.stripeUserId,
      livemode: exchanged.livemode === true,
      chargesEnabled: status.chargesEnabled === true,
      payoutsEnabled: status.payoutsEnabled === true,
      onboardingComplete: status.detailsSubmitted === true,
    },
    update: {
      stripeAccountId: exchanged.stripeUserId,
      livemode: exchanged.livemode === true,
      chargesEnabled: status.chargesEnabled === true,
      payoutsEnabled: status.payoutsEnabled === true,
      onboardingComplete: status.detailsSubmitted === true,
    },
  });

  return clearCookie(
    NextResponse.redirect(new URL('/settings/payments?stripe=connected', req.url))
  );
}
