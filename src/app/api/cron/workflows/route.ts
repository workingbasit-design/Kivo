import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runWorkflowsForBusiness } from '@/lib/workflows';

/**
 * Cron entry point for the safe workflow engine. Configure in the Vercel
 * dashboard (Cron Jobs) as a daily GET to:
 *
 *   /api/cron/workflows?secret=<CRON_SECRET>
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

  return NextResponse.json({
    ok: true,
    businesses: businesses.length,
    actionsFired: totalFired,
    perBusiness,
  });
}
