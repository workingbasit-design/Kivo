import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { headers } from 'next/headers';
import { getLiveSnapshot } from '@/lib/live-tracking';

/**
 * GET /api/track/[token]/ping — public live-tracking poll endpoint.
 * No authentication: the unguessable token in the URL is the only
 * capability (same as the /track/[token] page). Returns the technician's
 * latest ping plus straight-line distance and driving ETA to the job
 * address. Rate-limited per IP. Never 500s on bad data — it degrades to
 * `{ ok: true, latest: null }` so the customer page keeps polling.
 */

const PING_LIMIT = { limit: 30, windowMs: 60 * 1000 };

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown'
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const rl = rateLimit(`portal:track-ping:${await clientIp()}`, PING_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests — please wait a moment.' },
      { status: 429 }
    );
  }

  let share;
  try {
    share = await prisma.trackingShare.findFirst({
      where: { token },
      select: {
        expiresAt: true,
        job: { select: { id: true, address: true } },
      },
    });
  } catch {
    // Our side failed (e.g. database unreachable) — tell the client to keep
    // polling rather than 500ing. Never report a live link as expired.
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  if (!share || share.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'expired' }, { status: 404 });
  }

  let snap = null;
  try {
    snap = await getLiveSnapshot(share.job.id, share.job.address);
  } catch {
    snap = null;
  }
  if (!snap) return NextResponse.json({ ok: true, latest: null });

  const { lat, lng, recordedAt, ...rest } = snap;
  return NextResponse.json({
    ok: true,
    latest: { lat, lng, recordedAt },
    ...rest,
  });
}
