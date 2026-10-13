import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendDigestForBusiness } from '@/lib/digest';
import { unsafeUnscoped } from '@/lib/tenant-guard';

/**
 * Cron entry point for the morning digest. Scheduled hourly in vercel.json.
 * Each business opts in via DigestSetting (enabled + sendTime in its own
 * timezone); this route only sends when the business's local hour matches.
 *
 * Same secret pattern as the other cron routes: CRON_SECRET via Bearer or
 * ?secret=. Delivery is in-app Notification + VAPID web push — $0.
 * Idempotent per (business, date) via the digest dedupeKey.
 */
export const maxDuration = 120;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured.' },
      { status: 500 }
    );
  }
  const url = new URL(req.url);
  const provided =
    url.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // Cron fan-out (CRON_SECRET at route entry): enumerate digest settings.
  // Each send runs inside its own tenant scope in sendDigestForBusiness.
  const settings = await unsafeUnscoped('cron:digest:enumerate', (db) =>
    db.digestSetting.findMany({
      where: { enabled: true },
      select: {
        businessId: true,
        sendTime: true,
        channels: true,
        business: { select: { timezone: true } },
      },
    })
  );

  const now = new Date();
  const results: Array<{ businessId: string; sent: boolean; push: string }> = [];

  for (const s of settings) {
    try {
      const tz = s.business.timezone || 'America/Toronto';
      const localHourMin = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);
      // sendTime is "HH:MM"; fire when the local hour matches (cron runs hourly).
      const [wantH] = s.sendTime.split(':');
      const [nowH] = localHourMin.split(':');
      if (wantH !== nowH) continue;

      const channels = s.channels.split(',').map((c: string) => c.trim());
      const r = await sendDigestForBusiness(s.businessId, channels);
      results.push({ businessId: s.businessId, sent: r.notification, push: r.push });
    } catch (err) {
      console.error('[cron/digest] failed for business', s.businessId, err);
    }
  }

  return NextResponse.json({ ok: true, checked: settings.length, sent: results.length, results });
}
