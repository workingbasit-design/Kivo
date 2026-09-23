import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  googleOAuthConfigured,
  googleRedirectUri,
  buildAuthUrl,
  googleScopes,
} from '@/lib/google-reviews';

/**
 * Start Google OAuth: redirect the business owner to Google's consent
 * screen. The callback verifies the session, so the state only needs to
 * bind the request to the current business.
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

  const origin = new URL(req.url).origin;
  const url = buildAuthUrl({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    redirectUri: googleRedirectUri(origin),
    state: businessId,
    scopes: googleScopes(),
  });
  return NextResponse.redirect(url);
}
