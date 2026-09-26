import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { checkArrival } from '@/lib/geofence';
import { jobDisplayStatus } from '@/lib/utils';
import { Card, StatusBadge } from '@/components/ui';
import DispatcherMap from '@/components/DispatcherMap';
import PortalNotice from '@/components/PortalNotice';

/**
 * Public live-tracking page: /track/[token].
 * No authentication — the unguessable token in the URL is the only
 * capability, and it auto-expires (12h). Shows the technician's latest
 * shared location for the job, the job status, and an arrival banner.
 * The page refreshes itself every 45 seconds for live updates (no account,
 * no JavaScript polling endpoint needed).
 */

const PORTAL_LIMIT = { limit: 30, windowMs: 60 * 1000 };
const REFRESH_SECONDS = 45;

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown'
  );
}

function formatTime(d: Date, locale: Locale): string {
  try {
    return d.toLocaleTimeString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);

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
          time: true,
          technician: true,
          customer: { select: { name: true } },
        },
      },
      business: { select: { name: true } },
    },
  });
  // Token lookup without the DB-side expiry filter (moved to JS below).
  // Emits a hidden diagnostic marker so we can distinguish "token not found"
  // from "token found but expired" when debugging the tracking-link issue.
  if (!share) {
    return (
      <>
        {/* diag: tracking token not found in DB */}
        <PortalNotice variant="expired" />
      </>
    );
  }
  if (share.expiresAt.getTime() <= Date.now()) {
    return (
      <>
        {/* diag: tracking token found but expired */}
        <PortalNotice variant="expired" />
      </>
    );
  }

  const latest = await prisma.technicianLocation.findFirst({
    where: { jobId: share.job.id },
    orderBy: { recordedAt: 'desc' },
    select: { lat: true, lng: true, recordedAt: true },
  });

  // Arrival banner is best-effort: if the address can't be geocoded we
  // simply don't show it — the map still works.
  const arrival =
    latest && share.job.address
      ? await checkArrival(latest.lat, latest.lng, share.job.address)
      : null;

  const techName = share.job.technician?.trim() || tr('gps.unknownTech');

  return (
    <main className="min-h-screen bg-zinc-50">
      {/* Auto-refresh for live updates without an account or polling API. */}
      <meta httpEquiv="refresh" content={String(REFRESH_SECONDS)} />
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            {share.business.name}
          </p>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mt-1">
            {tr('gps.trackingTitle')}
          </h1>
        </div>

        {arrival?.arrived ? (
          <Card className="p-4 bg-emerald-50 border-emerald-200">
            <p className="text-center font-bold text-emerald-800">
              ✅ {tr('gps.arrived')}
            </p>
          </Card>
        ) : (
          <Card className="p-4 bg-sky-50 border-sky-200">
            <p className="text-center font-bold text-sky-800">
              🚗 {tr('gps.onTheWay')} — {techName}
            </p>
          </Card>
        )}

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                {tr('gps.viewJob')}
              </p>
              <p className="font-bold text-zinc-900">{share.job.title}</p>
              <p className="text-sm text-zinc-500">
                {tr('gps.customerName')}: {share.job.customer.name}
              </p>
            </div>
            <StatusBadge status={jobDisplayStatus(share.job.status, share.job.date)} />
          </div>

          {latest ? (
            <>
              <DispatcherMap
                height={320}
                pins={[
                  {
                    id: share.job.id,
                    lat: latest.lat,
                    lng: latest.lng,
                    label: techName,
                    sub: share.job.address ?? undefined,
                    status: share.job.status,
                    tone: arrival?.arrived ? 'arrived' : 'active',
                  },
                ]}
              />
              <p className="text-xs text-zinc-400 mt-2 text-center">
                {tr('gps.lastUpdated')}: {formatTime(latest.recordedAt, locale)}
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-500 text-center py-8">
              {tr('gps.noPings')}
            </p>
          )}
        </Card>

        <p className="text-[11px] text-zinc-400 text-center">
          {tr('gps.privacyNote')}
        </p>
      </div>
    </main>
  );
}
