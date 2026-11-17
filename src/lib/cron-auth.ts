import { timingSafeEqual, createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

/**
 * Cron authentication (P1.0, audit S2).
 *
 * Header-only: Vercel's scheduler sends `Authorization: Bearer $CRON_SECRET`
 * automatically when the CRON_SECRET env var is set, so no secret appears in
 * vercel.json or the repo. Manual runs use the same header:
 * `curl -H "Authorization: Bearer $CRON_SECRET" <host>/api/cron/<job>`.
 *
 * The `?secret=` query parameter is NOT accepted: query strings land in
 * access logs and Referer headers. An unset CRON_SECRET is a 401, not a 500
 * (a 500 leaks config state to unauthenticated callers).
 *
 * The comparison is constant-time: both sides are SHA-256 hashed first so
 * timingSafeEqual never throws on a length mismatch.
 *
 * Returns null when authorised, else a 401 JSON response.
 */
export function requireCronAuth(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '');
  if (!secret || !provided) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(secret).digest();
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return null;
}
