'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { t, type Locale } from '@/lib/i18n';
import { Card, StatusBadge } from '@/components/ui';
import DispatcherMap from '@/components/DispatcherMap';
import { jobDisplayStatus } from '@/lib/utils';
import { formatDistance, formatEta } from '@/lib/eta';

const POLL_MS = 15_000;

export interface TrackingSnapshot {
  lat: number;
  lng: number;
  /** ISO string — formatted in the VIEWER's timezone on the client. */
  recordedAt: string;
  straightM: number | null;
  driveM: number | null;
  driveS: number | null;
  arrived: boolean;
}

interface Props {
  token: string;
  locale: Locale;
  businessName: string;
  jobTitle: string;
  customerName: string;
  jobAddress: string | null;
  jobStatus: string;
  jobDate: string | null;
  /** Null when the job has no technician name — banner omits the name. */
  techName: string | null;
  initial: TrackingSnapshot | null;
}

function fill(template: string, key: string, value: string): string {
  return template.replace(`{${key}}`, value);
}

export default function LiveTrackingClient({
  token,
  locale,
  businessName,
  jobTitle,
  customerName,
  jobAddress,
  jobStatus,
  jobDate,
  techName,
  initial,
}: Props) {
  const tr = (path: string) => t(locale, path);
  const tag = locale === 'fr' ? 'fr-CA' : 'en-CA';

  const [snap, setSnap] = useState<TrackingSnapshot | null>(initial);
  const [expired, setExpired] = useState(false);
  const timerRef = useRef<number | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${encodeURIComponent(token)}/ping`);
      if (res.status === 404) {
        setExpired(true);
        return;
      }
      if (!res.ok) return; // 429 etc. — keep old data, try again next tick
      const data = (await res.json()) as {
        ok: boolean;
        latest: { lat: number; lng: number; recordedAt: string } | null;
        straightM: number | null;
        driveM: number | null;
        driveS: number | null;
        arrived: boolean;
      };
      if (!data.ok) return;
      if (!data.latest) {
        setSnap((prev) =>
          prev ? { ...prev, arrived: data.arrived } : prev
        );
        return;
      }
      setSnap({
        lat: data.latest.lat,
        lng: data.latest.lng,
        recordedAt: data.latest.recordedAt,
        straightM: data.straightM,
        driveM: data.driveM,
        driveS: data.driveS,
        arrived: data.arrived,
      });
    } catch {
      // Transient network failure — keep the last known position.
    }
  }, [token]);

  useEffect(() => {
    timerRef.current = window.setInterval(poll, POLL_MS);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [poll]);

  if (expired) {
    // Inline expired UI — PortalNotice imports server-only i18n helpers and
    // cannot render inside a client component.
    return (
      <div data-track-diag="token-expired">
        <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
              ⏰
            </div>
            <h1 className="text-lg font-semibold text-slate-900">
              {tr('tracking.expiredTitle')}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {tr('tracking.expiredBody')}
            </p>
            <p className="mt-4 text-xs text-slate-400">{businessName}</p>
          </div>
        </main>
      </div>
    );
  }

  const arrived = snap?.arrived ?? false;
  const displayStatus = jobDisplayStatus(
    jobStatus,
    jobDate ? new Date(jobDate) : null
  );

  // Viewer-local time — the server can only render UTC, which is why the
  // old page showed the wrong hour.
  const updatedLabel = snap
    ? new Date(snap.recordedAt).toLocaleTimeString(tag, {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  // Prefer road distance/ETA; fall back to straight-line distance.
  const distanceM = snap?.driveM ?? snap?.straightM ?? null;
  const distanceLabel =
    distanceM !== null && !arrived
      ? fill(tr('gps.distanceAway'), 'd', formatDistance(distanceM, locale))
      : null;
  const etaLabel =
    snap?.driveS !== null && snap?.driveS !== undefined && !arrived
      ? fill(tr('gps.etaLabel'), 't', formatEta(snap.driveS, locale))
      : null;

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-xl px-4 py-6 sm:py-10 space-y-4">
        {/* Header */}
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            {businessName}
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
              {tr('gps.trackingTitle')}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-rose-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600" />
              </span>
              {tr('gps.liveNow')}
            </span>
          </div>
        </div>

        {/* Status banner */}
        {arrived ? (
          <Card className="p-4 bg-emerald-50 border-emerald-200">
            <p className="text-center font-bold text-emerald-800">
              ✅ {tr('gps.arrived')}
              {techName ? ` — ${techName}` : ''}
            </p>
          </Card>
        ) : (
          <Card className="p-4 bg-sky-50 border-sky-200">
            <p className="text-center font-bold text-sky-900">
              🚗 {tr('gps.onTheWay')}
              {techName ? ` — ${techName}` : ''}
            </p>
          </Card>
        )}

        {/* Distance + ETA chips */}
        {!arrived && (distanceLabel || etaLabel) && (
          <div className="grid grid-cols-2 gap-3">
            {distanceLabel && (
              <Card className="p-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  📍 {tr('gps.distance')}
                </p>
                <p className="mt-1 text-xl font-extrabold text-zinc-900">
                  {distanceLabel}
                </p>
              </Card>
            )}
            {etaLabel && (
              <Card className="p-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  ⏱ ETA
                </p>
                <p className="mt-1 text-xl font-extrabold text-zinc-900">
                  {etaLabel}
                </p>
              </Card>
            )}
          </div>
        )}

        {/* Map */}
        <Card className="p-4 sm:p-5">
          {snap ? (
            <>
              <DispatcherMap
                height={300}
                pins={[
                  {
                    id: 'tech',
                    lat: snap.lat,
                    lng: snap.lng,
                    label: techName ?? tr('gps.unknownTech'),
                    sub: jobAddress ?? undefined,
                    status: displayStatus,
                    tone: arrived ? 'arrived' : 'active',
                  },
                ]}
              />
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-zinc-500">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                </span>
                {updatedLabel
                  ? `${tr('gps.lastUpdated')}: ${updatedLabel}`
                  : tr('gps.lastUpdated')}
                <span aria-hidden>·</span>
                <span>{tr('gps.autoRefresh')}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500 text-center py-10">
              {tr('gps.noPings')}
            </p>
          )}
        </Card>

        {/* Job details */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                {tr('gps.viewJob')}
              </p>
              <p className="font-bold text-zinc-900 truncate">{jobTitle}</p>
              <p className="text-sm text-zinc-500 mt-0.5">
                {tr('gps.customerName')}: {customerName}
              </p>
              {jobAddress && (
                <p className="text-sm text-zinc-500 mt-0.5">📍 {jobAddress}</p>
              )}
              {techName && (
                <p className="text-sm text-zinc-500 mt-0.5">
                  {tr('gps.techLabel')}: {techName}
                </p>
              )}
            </div>
            <StatusBadge status={displayStatus} />
          </div>
        </Card>

        <p className="text-[11px] text-zinc-400 text-center px-4">
          {tr('gps.privacyNote')}
        </p>
      </div>
    </main>
  );
}
