import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron-auth';
import { runMessagingCycle } from '@/lib/messaging/engine';
import { unsafeUnscoped } from '@/lib/tenant-guard';

/**
 * Cron entry point for automated messaging.
 *
 * Auth: Vercel's scheduler automatically sends
 * `Authorization: Bearer $CRON_SECRET` when the CRON_SECRET env var is set,
 * so no secret appears in vercel.json or the repo. Manual runs use the same
 * Bearer header (see `src/lib/cron-auth.ts`); the `?secret=` query parameter
 * is not accepted.
 *
 * Each cycle respects the business's dryRun flag: businesses still in
 * preview mode only get DRY_RUN log rows, so nothing can send before the
 * owner opts in.
 */
export const maxDuration = 120;

export async function GET(req: Request) {
  const unauth = requireCronAuth(req);
  if (unauth) return unauth;

  // Cron fan-out (CRON_SECRET at route entry): enumerate opted-in
  // businesses. Each business's sends run inside its own tenant scope
  // with per-business quota checks in runMessagingCycle.
  const businesses = await unsafeUnscoped('cron:messaging:fanout', (db) =>
    db.messagingSettings.findMany({
      where: {
        OR: [
          { reminder24h: true },
          { reminderDayOf: true },
          { invoiceDue: true },
          { invoiceOverdue: true },
          { quoteFollowup: true },
          { reviewRequest: true },
        ],
      },
      select: { businessId: true },
      take: 200,
    })
  );

  const results: Array<{ businessId: string; ok: boolean; sent?: number; error?: string }> = [];
  for (const { businessId } of businesses) {
    try {
      const report = await runMessagingCycle(businessId);
      results.push({ businessId, ok: true, sent: report.sent });
    } catch (err) {
      results.push({
        businessId,
        ok: false,
        error: err instanceof Error ? err.message : 'Cycle failed.',
      });
    }
  }
  return NextResponse.json({
    ranAt: new Date().toISOString(),
    businesses: results.length,
    results,
  });
}
