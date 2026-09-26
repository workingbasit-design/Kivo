import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';
import { newShareTokenValue } from '@/lib/share';
import { unsafeUnscoped } from '@/lib/tenant-guard';

/**
 * POST /api/tracking/share — create (or refresh) the customer-facing live
 * tracking link for a job ("tech is on the way").
 *
 * The link resolves by unguessable token at /track/[token] with no login.
 * Tokens auto-expire after 12 hours; refreshing issues a new token and a new
 * expiry. Only jobs of this business that are SCHEDULED or IN PROGRESS can
 * get a link.
 */

const ACTIVE_STATUSES = ['SCHEDULED', 'IN PROGRESS'] as const;
const SHARE_TTL_HOURS = 12;
const SHARE_LIMIT = { limit: 30, windowMs: 60_000 };

const shareSchema = z.object({
  jobId: z.string().min(1).max(64),
});

export async function POST(req: Request) {
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) return originForbidden(originCheck.reason);

  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!session || !businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(`tracking-share:${session.user.id}`, SHARE_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = shareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const job = await prisma.job.findFirst({
    where: {
      id: parsed.data.jobId,
      businessId,
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: { id: true },
  });
  if (!job) {
    return NextResponse.json(
      { error: 'Tracking links are only available for your active jobs.' },
      { status: 403 }
    );
  }

  const expiresAt = new Date(Date.now() + SHARE_TTL_HOURS * 60 * 60 * 1000);
  // job.id was business-verified 15 lines above; jobId is this table's
  // unique key, so the upsert can only ever touch this tenant's row.
  const share = await unsafeUnscoped('tracking:share:upsert', () =>
    prisma.trackingShare.upsert({
      where: { jobId: job.id },
      create: {
        businessId,
        jobId: job.id,
        token: newShareTokenValue(),
        expiresAt,
      },
      update: {
        token: newShareTokenValue(),
        expiresAt,
      },
      select: { token: true, expiresAt: true },
    })
  );

  return NextResponse.json({
    ok: true,
    token: share.token,
    url: `/track/${share.token}`,
    expiresAt: share.expiresAt,
  });
}

/**
 * GET /api/tracking/share?jobId=... — return the current active tracking
 * link for a job, if any. Lets the UI show the existing link after a page
 * reload instead of forcing the tech to create a new one.
 */
export async function GET(req: Request) {
  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!session || !businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId.' }, { status: 400 });
  }
  const share = await prisma.trackingShare.findFirst({
    where: { jobId, businessId, expiresAt: { gt: new Date() } },
    select: { token: true, expiresAt: true },
  });
  if (!share) return NextResponse.json({ ok: true, url: null });
  return NextResponse.json({
    ok: true,
    url: `/track/${share.token}`,
    expiresAt: share.expiresAt,
  });
}

/**
 * DELETE /api/tracking/share?jobId=... — revoke the tracking link for a job.
 * The customer link stops working immediately.
 */
export async function DELETE(req: Request) {
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) return originForbidden(originCheck.reason);

  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!session || !businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId.' }, { status: 400 });
  }
  await prisma.trackingShare.deleteMany({ where: { jobId, businessId } });
  return NextResponse.json({ ok: true });
}
