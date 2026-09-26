import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { unsafeUnscoped } from '@/lib/tenant-guard';

const subscribeSchema = z.object({
  endpoint: z.string().trim().url().max(2000),
  keys: z.object({
    p256dh: z.string().trim().min(1).max(500),
    auth: z.string().trim().min(1).max(500),
  }),
});

/**
 * POST /api/push/subscribe — register this device for push notifications.
 *
 * Tenant-scoped: the subscription is stored against the caller's businessId.
 * Idempotent: subscribing the same endpoint twice updates rather than
 * duplicating (endpoint is @unique).
 */
export async function POST(req: NextRequest) {
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) return originForbidden();

  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const rl = rateLimit(`push-subscribe:${businessId}`, ACTION_LIMIT);
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
  // endpoint is the device's unique push URL (unguessable); the upsert
  // binds it to the authenticated session's business and rewrites keys.
  // Authenticated route — no other tenant's data is readable here.
  await unsafeUnscoped('push:subscribe:upsert', () =>
    prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { businessId, userId: session.userId ?? null, p256dh: keys.p256dh, auth: keys.auth },
      create: {
        businessId,
        userId: session.userId ?? null,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    })
  );

  return NextResponse.json({ ok: true });
}
