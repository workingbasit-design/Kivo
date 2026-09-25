import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';

/**
 * POST /api/locations/ping — record one GPS ping from a technician's device.
 *
 * Privacy-first: a ping is accepted ONLY when the referenced job belongs to
 * the caller's business AND is SCHEDULED or IN PROGRESS. Pings for completed,
 * cancelled, paid, or foreign jobs are rejected — so no location is ever
 * recorded outside active work, even if a device keeps sending.
 */

const ACTIVE_STATUSES = ['SCHEDULED', 'IN PROGRESS'] as const;

// One ping per 15 s per tech is the client cadence; 60/min leaves headroom
// for retries while stopping abuse.
const PING_LIMIT = { limit: 60, windowMs: 60_000 };

const pingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().positive().max(100_000).optional(),
  jobId: z.string().min(1).max(64),
});

export async function POST(req: Request) {
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) return originForbidden(originCheck.reason);

  const session = await getSession();
  const businessId = session?.user?.businessId;
  const userId = session?.user?.id;
  if (!session || !businessId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(`gps-ping:${userId}`, PING_LIMIT);
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
  const parsed = pingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid location payload.' }, { status: 400 });
  }
  const { lat, lng, accuracy, jobId } = parsed.data;

  // Tenant isolation + active-job gate: the job must belong to this business
  // and be scheduled or in progress. Anything else → no ping is stored.
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      businessId,
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: { id: true },
  });
  if (!job) {
    return NextResponse.json(
      { error: 'Location sharing is only available for your active jobs.', code: 'JOB_INACTIVE' },
      { status: 403 }
    );
  }

  await prisma.technicianLocation.create({
    data: {
      businessId,
      userId,
      jobId: job.id,
      lat,
      lng,
      accuracy: accuracy ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
