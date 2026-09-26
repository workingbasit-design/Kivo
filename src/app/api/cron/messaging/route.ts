import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runMessagingCycle } from '@/lib/messaging/engine';
import { unsafeUnscoped } from '@/lib/tenant-guard';

/**
 * Cron entry point for automated messaging.
 *
 * Auth: Vercel's scheduler automatically sends
 * `Authorization: Bearer $CRON_SECRET` when the CRON_SECRET env var is set,
 * so no secret appears in vercel.json or the repo. The `?secret=` query
 * parameter (or Bearer header) also works for manual runs.
 *
 * Each cycle respects the business's dryRun flag: businesses still in
 * preview mode only get DRY_RUN log rows, so nothing can send before the
 * owner opts in.
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

  // Cron fan-out (CRON_SECRET at route entry): enumerate opted-in
  // businesses. Each business's sends run inside its own tenant scope
  // with per-business quota checks in runMessagingCycle.
  const businesses = await unsafeUnscoped('cron:messaging:fanout', () =>
    prisma.messagingSettings.findMany({
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
