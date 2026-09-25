import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';

/**
 * GET /api/locations/latest — dispatcher view: the latest ping for each of
 * the business's SCHEDULED / IN PROGRESS jobs, with job + customer context.
 * Tenant-scoped: only this business's jobs and pings are ever returned.
 */

const ACTIVE_STATUSES = ['SCHEDULED', 'IN PROGRESS'] as const;
const LATEST_LIMIT = { limit: 60, windowMs: 60_000 };
const MAX_JOBS = 50;

export async function GET(req: Request) {
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) return originForbidden(originCheck.reason);

  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!session || !businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(`gps-latest:${session.user.id}`, LATEST_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down.' },
      { status: 429 }
    );
  }

  const jobs = await prisma.job.findMany({
    where: { businessId, status: { in: [...ACTIVE_STATUSES] } },
    select: {
      id: true,
      title: true,
      address: true,
      status: true,
      date: true,
      time: true,
      technician: true,
      customer: { select: { name: true } },
    },
    orderBy: { date: 'asc' },
    take: MAX_JOBS,
  });

  const jobIds = jobs.map((j) => j.id);
  const pings =
    jobIds.length === 0
      ? []
      : await prisma.technicianLocation.findMany({
          where: { businessId, jobId: { in: jobIds } },
          select: {
            jobId: true,
            lat: true,
            lng: true,
            accuracy: true,
            recordedAt: true,
            userId: true,
          },
          orderBy: { recordedAt: 'desc' },
          take: MAX_JOBS * 4,
        });

  // First row per jobId is the latest (ordered desc above).
  const latestByJob = new Map<string, (typeof pings)[number]>();
  for (const p of pings) {
    if (p.jobId && !latestByJob.has(p.jobId)) latestByJob.set(p.jobId, p);
  }

  return NextResponse.json({
    ok: true,
    jobs: jobs.map((j) => {
      const latest = latestByJob.get(j.id) ?? null;
      return {
        id: j.id,
        title: j.title,
        address: j.address,
        status: j.status,
        date: j.date,
        time: j.time,
        technician: j.technician,
        customerName: j.customer.name,
        latest: latest
          ? {
              lat: latest.lat,
              lng: latest.lng,
              accuracy: latest.accuracy,
              recordedAt: latest.recordedAt,
            }
          : null,
      };
    }),
  });
}
