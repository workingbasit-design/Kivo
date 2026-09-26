import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { getLocale } from '@/lib/i18n/server';
import PortalNotice from '@/components/PortalNotice';
import LiveTrackingClient from '@/components/LiveTrackingClient';
import { getLiveSnapshot } from '@/lib/live-tracking';

/**
 * Public live-tracking page: /track/[token].
 * No authentication — the unguessable token in the URL is the only
 * capability, and it auto-expires (12h). The server validates the token
 * and renders the initial snapshot; the client component then polls
 * /api/track/[token]/ping every 15 seconds and formats times in the
 * VIEWER's timezone (the server can only render UTC, which showed the
 * wrong hour).
 */

const PORTAL_LIMIT = { limit: 30, windowMs: 60 * 1000 };

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown'
  );
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = await getLocale();

  const rl = rateLimit(`portal:track:${await clientIp()}`, PORTAL_LIMIT);
  if (!rl.ok) return <PortalNotice variant="rate-limited" />;

  const share = await prisma.trackingShare.findFirst({
    where: { token },
    select: {
      expiresAt: true,
      job: {
        select: {
          id: true,
          title: true,
          status: true,
          address: true,
          date: true,
          technician: true,
          customer: { select: { name: true } },
        },
      },
      business: { select: { name: true } },
    },
  });
  // Token lookup without the DB-side expiry filter (moved to JS below).
  // The data-track-diag attribute is a real, greppable marker (JSX comments
  // are stripped at compile time and never reach the browser) so we can
  // distinguish "token not found" from "token found but expired" when
  // debugging the tracking-link issue.
  if (!share) {
    return (
      <div data-track-diag="token-not-found">
        <PortalNotice variant="expired" />
      </div>
    );
  }
  if (share.expiresAt.getTime() <= Date.now()) {
    return (
      <div data-track-diag="token-expired">
        <PortalNotice variant="expired" />
      </div>
    );
  }

  const initial = await getLiveSnapshot(share.job.id, share.job.address);
  const techName = share.job.technician?.trim() || null;

  return (
    <LiveTrackingClient
      token={token}
      locale={locale}
      businessName={share.business.name}
      jobTitle={share.job.title}
      customerName={share.job.customer.name}
      jobAddress={share.job.address}
      jobStatus={share.job.status}
      jobDate={share.job.date ? share.job.date.toISOString() : null}
      techName={techName}
      initial={initial}
    />
  );
}
