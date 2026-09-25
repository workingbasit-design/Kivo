import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';

const unsubscribeSchema = z.object({
  endpoint: z.string().trim().url().max(2000),
});

/**
 * POST /api/push/unsubscribe — remove this device's push subscription.
 *
 * Tenant-scoped: only deletes rows belonging to the caller's business, so
 * one business can never remove another's device.
 */
export async function POST(req: NextRequest) {
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) return originForbidden();

  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const rl = rateLimit(`push-unsubscribe:${businessId}`, ACTION_LIMIT);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid subscription.' },
      { status: 400 }
    );
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, businessId },
  });

  return NextResponse.json({ ok: true });
}
