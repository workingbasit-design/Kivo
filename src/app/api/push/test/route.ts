import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { normalizeLocale, t } from '@/lib/i18n';
import { isPushConfigured, sendPushNotification } from '@/lib/webpush';

const testSchema = z.object({
  locale: z.enum(['en', 'fr']).optional().default('en'),
});

/**
 * POST /api/push/test — send a test notification to every device registered
 * for this business.
 *
 * Tenant-scoped: only this business's subscriptions are touched. Dead
 * subscriptions (410/404 from the push service) are pruned automatically.
 * Graceful when VAPID keys are missing: returns { configured: false } and
 * the UI shows the "not set up" state.
 */
export async function POST(req: NextRequest) {
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) return originForbidden();

  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  // Sending pushes costs nothing, but a test button shouldn't be hammerable.
  const rl = rateLimit(`push-test:${businessId}`, { limit: 10, windowMs: 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  if (!isPushConfigured()) {
    return NextResponse.json({ configured: false, sent: 0, pruned: 0 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = testSchema.safeParse(body);
  const locale = normalizeLocale(parsed.success ? parsed.data.locale : 'en');

  const subs = await prisma.pushSubscription.findMany({
    where: { businessId },
    select: { endpoint: true, p256dh: true, auth: true },
  });

  let sent = 0;
  const dead: string[] = [];
  for (const sub of subs) {
    const res = await sendPushNotification(sub, {
      title: t(locale, 'pwa.push.testTitle'),
      body: t(locale, 'pwa.push.testBody'),
      url: '/dashboard',
      tag: 'everyjob-test',
    });
    if (res.ok) {
      sent += 1;
    } else if ('expired' in res && res.expired) {
      dead.push(sub.endpoint);
    }
  }

  if (dead.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { businessId, endpoint: { in: dead } },
    });
  }

  return NextResponse.json({ configured: true, sent, pruned: dead.length, devices: subs.length });
}
