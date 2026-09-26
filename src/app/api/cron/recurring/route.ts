import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateDueJobs } from '@/lib/recurring';
import { defaultTimezoneForRegion, toISODateInTimezone } from '@/lib/utils';

/**
 * Cron entry point for recurring-job auto-generation. Scheduled in
 * vercel.json as a daily GET to /api/cron/recurring. Vercel automatically
 * sends `Authorization: Bearer $CRON_SECRET` when the CRON_SECRET env var
 * is set, so no secret appears in vercel.json or the repo; the `?secret=`
 * query parameter also works for manual runs.
 *
 * The secret is required — without it the route refuses to run.
 * Generation is idempotent (per-plan transaction + @@unique backstop),
 * business-timezone aware, and every run is written to AutomationLog.
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

  // Only businesses with at least one active plan need a generation pass.
  const businesses = await prisma.business.findMany({
    where: { recurringJobs: { some: { active: true } } },
    select: { id: true, name: true, timezone: true, regionCode: true },
  });

  let totalCreated = 0;
  const perBusiness: Array<{ businessId: string; created: number }> = [];

  for (const b of businesses) {
    try {
      const { created } = await generateDueJobs(b.id);
      totalCreated += created;
      perBusiness.push({ businessId: b.id, created });
      const tz = b.timezone || defaultTimezoneForRegion(b.regionCode);
      await prisma.automationLog.create({
        data: {
          businessId: b.id,
          kind: 'RECURRING',
          summary: `Recurring generation: ${created} job${created === 1 ? '' : 's'} created (${toISODateInTimezone(new Date(), tz)} ${tz}).`,
          metaJson: JSON.stringify({ created, date: toISODateInTimezone(new Date(), tz) }),
        },
      });
    } catch (err) {
      await prisma.automationLog.create({
        data: {
          businessId: b.id,
          kind: 'RECURRING',
          summary: `Recurring generation failed: ${err instanceof Error ? err.message : 'unknown error'}.`,
        },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    businesses: businesses.length,
    jobsCreated: totalCreated,
    perBusiness,
  });
}
