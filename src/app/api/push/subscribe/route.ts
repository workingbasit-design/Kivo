import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getActiveMembershipForUser } from '@/lib/membership';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';
import { rateLimitDurable, ACTION_LIMIT } from '@/lib/rate-limit-durable';
import { unsafeUnscoped } from '@/lib/tenant-guard';

const subscribeSchema = z.object({
  endpoint: z.string().trim().url().max(2000),
  keys: z.object({
    p256dh: z.string().trim().min(1).max(500),
    auth: z.string().trim().min(1).max(500),
  }),
});

/**
 * POST /api/push/subscribe - register this device for push notifications.
 *
 * Tenant-scoped: the subscription is stored against the caller's businessId.
 * Idempotent: subscribing the same endpoint twice updates rather than
 * duplicating (endpoint is @unique).
 */
export async function POST(req: NextRequest) {
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) return originForbidden();

  const session = await getSession();
  const membership = session ? await getActiveMembershipForUser(session.user.id) : null;
  const businessId = membership?.businessId;
  const userId = session?.userId ?? null;
  if (!businessId) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const rl = await rateLimitDurable(`push-subscribe:${businessId}`, ACTION_LIMIT);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid subscription.' },
      { status: 400 }
    );
  }

  const { endpoint, keys } = parsed.data;
  // P1.0 (S-A3): endpoint is the device's unique push URL (unguessable),
  // but it is @unique — so an upsert keyed ONLY by endpoint would let any
  // authenticated user rebind another business's device to their own
  // business and receive (or silence) the victim's pushes. Check ownership
  // first and refuse to touch a foreign subscription. The lookup is by the
  // unguessable endpoint and returns only the owning businessId.
  const existing = await unsafeUnscoped('push:subscribe:checkOwner', (db) =>
    db.pushSubscription.findFirst({
      where: { endpoint },
      select: { businessId: true },
    })
  );
  if (existing && existing.businessId !== businessId) {
    return NextResponse.json(
      { error: 'This device is already registered to another business.' },
      { status: 403 },
    );
  }
  // The upsert is only reached after the ownership check above, so
  // re-binding a foreign row is impossible here; the unscoped client is
  // needed because upsert's where is {endpoint} (no businessId to scope by).
  await unsafeUnscoped('push:subscribe:upsert', (db) =>
    db.pushSubscription.upsert({
      where: { endpoint },
      update: { businessId, userId, p256dh: keys.p256dh, auth: keys.auth },
      create: {
        businessId,
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    })
  );

  return NextResponse.json({ ok: true });
}
