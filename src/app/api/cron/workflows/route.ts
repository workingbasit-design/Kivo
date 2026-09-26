import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runWorkflowsForBusiness } from '@/lib/workflows';
import { dispatchWebhookRetries } from '@/lib/webhooks';
import { pruneStaleLocationPings } from '@/lib/ping-retention';
import { syncJobsToGoogleCalendar } from '@/lib/googleCalendarSync';
import { unsafeUnscoped } from '@/lib/tenant-guard';

/**
 * Cron entry point for the safe workflow engine. Scheduled in vercel.json
 * as a daily GET to /api/cron/workflows. Vercel automatically sends
 * `Authorization: Bearer $CRON_SECRET` when the CRON_SECRET env var is
 * set, so no secret appears in vercel.json or the repo; the `?secret=`
 * query parameter also works for manual runs.
 *
 * The secret is required — without it the route refuses to run. Actions are
 * limited to in-app notifications and draft creation (never external sends),
 * every firing is idempotent, and every run is written to AutomationLog.
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

  // Only businesses with at least one enabled rule need an engine pass.
  const businesses = await prisma.business.findMany({
    where: { workflowRules: { some: { enabled: true } } },
    select: { id: true },
  });

  let totalFired = 0;
  const perBusiness: Array<{ businessId: string; fired: number; rulesEvaluated: number }> = [];

  for (const b of businesses) {
    try {
      const r = await runWorkflowsForBusiness(b.id);
      totalFired += r.fired;
      perBusiness.push({ businessId: b.id, fired: r.fired, rulesEvaluated: r.rulesEvaluated });
    } catch (err) {
      await prisma.automationLog.create({
        data: {
          businessId: b.id,
          kind: 'WORKFLOW',
          summary: `Workflow run failed: ${err instanceof Error ? err.message : 'unknown error'}.`,
        },
      });
    }
  }

  // Ecosystem maintenance (all best-effort — a failure here must never break
  // the workflow run): retry due webhook deliveries, prune stale GPS pings,
  // and sync jobs to Google Calendar for businesses that granted write scope.
  let webhookStats = { attempted: 0, delivered: 0, failed: 0 };
  try {
    webhookStats = await dispatchWebhookRetries(50);
  } catch (err) {
    console.error('[cron] webhook retries failed:', err);
  }

  let pingsPruned = 0;
  try {
    pingsPruned = await pruneStaleLocationPings();
  } catch (err) {
    console.error('[cron] GPS ping pruning failed:', err);
  }

  let calendarSyncs = { ok: 0, skipped: 0 };
  try {
    // Cron fan-out (CRON_SECRET at route entry): enumerate calendar
    // connections. Each sync runs inside its own tenant scope in
    // syncJobsToGoogleCalendar(c.businessId).
    const calBusinesses = await unsafeUnscoped('cron:workflows:calendarFanout', () =>
      prisma.googleConnection.findMany({
        where: { scopes: { contains: 'calendar' } },
        select: { businessId: true },
      })
    );
    for (const c of calBusinesses) {
      try {
        const r = await syncJobsToGoogleCalendar(c.businessId);
        if (r.ok) calendarSyncs.ok++;
        else calendarSyncs.skipped++;
      } catch (err) {
        console.error(`[cron] calendar sync failed for ${c.businessId}:`, err);
        calendarSyncs.skipped++;
      }
    }
  } catch (err) {
    console.error('[cron] calendar sync sweep failed:', err);
  }

  return NextResponse.json({
    ok: true,
    businesses: businesses.length,
    actionsFired: totalFired,
    perBusiness,
    webhooks: webhookStats,
    pingsPruned,
    calendarSyncs,
  });
}
