import { NextResponse } from 'next/server';
import { getVapidPublicKey, isPushConfigured } from '@/lib/webpush';

/**
 * GET /api/push/vapid-public-key
 *
 * Public by design: the VAPID *public* key is meant to be shared with
 * browsers so they can create push subscriptions. Also reports whether
 * push is configured at all so the UI can show a friendly "not set up"
 * state instead of failing silently.
 */
export async function GET() {
  return NextResponse.json({
    configured: isPushConfigured(),
    publicKey: getVapidPublicKey(),
  });
}
