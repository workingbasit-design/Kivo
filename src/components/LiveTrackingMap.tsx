'use client';

import { useEffect, useState } from 'react';
import DispatcherMap, { type MapPin } from '@/components/DispatcherMap';
import { Button } from '@/components/kit';
import { t } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

interface LatestJob {
  id: string;
  title: string;
  address?: string | null;
  status: string;
  technician?: string | null;
  customerName: string;
  latest: { lat: number; lng: number; accuracy?: number | null; recordedAt: string } | null;
}

/** Polls GET /api/locations/latest and renders the dispatcher map. */
export default function LiveTrackingMap({ locale = 'en' }: { locale?: Locale }) {
  const [jobs, setJobs] = useState<LatestJob[]>([]);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [sharing, setSharing] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/locations/latest', { credentials: 'same-origin' });
        if (!res.ok) {
          setLoaded(true);
          return;
        }
        const data = await res.json();
        if (cancelled || !data?.ok || !Array.isArray(data.jobs)) {
          setLoaded(true);
          return;
        }
        const jobs = data.jobs as LatestJob[];
        setJobs(jobs);
        const next: MapPin[] = jobs
          .filter((j) => j.latest)
          .map((j) => ({
            id: j.id,
            lat: j.latest!.lat,
            lng: j.latest!.lng,
            label: j.title,
            sub: [j.customerName, j.technician].filter(Boolean).join(' · '),
            status: j.status,
            tone: 'active' as const,
            updatedAt: j.latest!.recordedAt,
          }));
        setPins(next);
        setSharing(next.length);
        setLoaded(true);
      } catch {
        // Offline or transient - keep the last known pins.
        setLoaded(true);
      }
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-ink" />
      </div>
    );
  }

  // No active jobs at all
  if (jobs.length === 0) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-3xl">
          🗺️
        </div>
        <h3 className="text-lg font-bold text-ink">
          {t(locale, 'gps.noJobsTitle') || 'No active jobs today'}
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-2">
          {t(locale, 'gps.noJobsDesc') || 'When you have scheduled jobs, they\'ll appear here. Your technician\'s live location shows on the map once they start sharing.'}
        </p>
        <Button variant="primary" sm href="/jobs/new" className="mt-4">
          + {t(locale, 'gps.scheduleJob') || 'Schedule a job'}
        </Button>
      </div>
    );
  }

  // Jobs exist but none are sharing location
  if (sharing === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-info-bg border border-info/25 p-4">
          <h3 className="font-bold text-info text-sm">
            📍 {t(locale, 'gps.howToShareTitle') || 'How live tracking works'}
          </h3>
          <ol className="mt-2 space-y-1.5 text-sm text-ink-2">
            <li>1. {t(locale, 'gps.howToShare1') || 'Open the job on your technician\'s phone'}</li>
            <li>2. {t(locale, 'gps.howToShare2') || 'Tap "Share my location" when starting the job'}</li>
            <li>3. {t(locale, 'gps.howToShare3') || 'Their live position appears on this map, auto-refreshing every 30 seconds'}</li>
          </ol>
          <p className="mt-2 text-xs text-ink-2">
            {t(locale, 'gps.privacyNoteShort') || 'Location is only shared during active jobs and auto-deletes after 24 hours.'}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-bold text-ink mb-2">
            {t(locale, 'gps.todaysJobs') || "Today's jobs"} ({jobs.length})
          </h3>
          <div className="space-y-2">
            {jobs.map((job) => (
              <a
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:border-line-strong hover:shadow-sm transition-shadow"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-lg">
                  🔧
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{job.title}</p>
                  <p className="truncate text-xs text-ink-2">
                    {[job.customerName, job.technician].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-2">
                  {t(locale, 'gps.notSharing') || 'Not sharing'}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Active sharing - show map + job list
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ok opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ok" />
        </span>
        <p className="text-sm font-semibold text-ink">
          {t(locale, 'gps.sharingNow').replace('{count}', String(sharing))}
        </p>
      </div>
      <DispatcherMap pins={pins} />
      <div>
        <h3 className="text-sm font-bold text-ink mb-2">
          {t(locale, 'gps.sharingJobs') || 'Currently sharing'} ({sharing})
        </h3>
        <div className="space-y-2">
          {jobs.filter((j) => j.latest).map((job) => (
            <a
              key={job.id}
              href={`/jobs/${job.id}`}
              className="flex items-center gap-3 rounded-xl border border-ok/25 bg-ok-bg/50 p-3 hover:shadow-sm transition-shadow"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ok-bg text-lg">
                📍
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{job.title}</p>
                <p className="truncate text-xs text-ink-2">
                  {[job.customerName, job.technician].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-ok-bg px-2.5 py-1 text-[11px] font-bold text-ok">
                ● {t(locale, 'gps.live') || 'LIVE'}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
