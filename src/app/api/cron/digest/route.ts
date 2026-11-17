import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron-auth';
import { sendDigestForBusiness } from '@/lib/digest';
import { unsafeUnscoped } from '@/lib/tenant-guard';

/**
 * Cron entry point for the morning digest. Scheduled once daily in
 * vercel.json (12:00 UTC). Each business opts in via DigestSetting
 * (enabled + sendTime in its own timezone); this route only sends when
 * the business's local time has reached its sendTime.
 * Same secret pattern as the other cron routes: CRON_SECRET via Bearer
 * header only (see `src/lib/cron-auth.ts`). Delivery is in-app Notification + VAPID web push - $0.
 * ?secret=. Delivery is in-app Notification + VAPID web push - $0.
 * Idempotent per (business, date) via the digest dedupeKey.
 */
export const maxDuration = 120;

export async function GET(req: Request) {
  const unauth = requireCronAuth(req);
  if (unauth) return unauth;

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
      // sendTime is "HH:MM"; fire when local time has reached sendTime.
      // Cron runs once daily (Vercel Hobby allows at most once per day), so
      // use >= instead of exact hour match - exact match would miss across
      // DST changes. Idempotency per (business, date) via dedupeKey
      // prevents double-sends.
      const [wantH, wantM] = s.sendTime.split(':').map(Number);
      const [nowH, nowM] = localHourMin.split(':').map(Number);
      if (nowH * 60 + nowM < wantH * 60 + wantM) continue;

      const channels = s.channels.split(',').map((c: string) => c.trim());
      const r = await sendDigestForBusiness(s.businessId, channels);
      results.push({ businessId: s.businessId, sent: r.notification, push: r.push });
    } catch (err) {
      console.error('[cron/digest] failed for business', s.businessId, err);
    }
  }

  return NextResponse.json({ ok: true, checked: settings.length, sent: results.length, results });
}
