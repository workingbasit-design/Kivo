'use client';

import { useEffect, useState } from 'react';
import DispatcherMap, { type MapPin } from '@/components/DispatcherMap';
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
  const [pins, setPins] = useState<MapPin[]>([]);
  const [sharing, setSharing] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/locations/latest', { credentials: 'same-origin' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.ok || !Array.isArray(data.jobs)) return;
        const jobs = data.jobs as LatestJob[];
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
          }));
        setPins(next);
        setSharing(next.length);
      } catch {
        // Offline or transient — keep the last known pins.
      }
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">
        {sharing === 0
          ? t(locale, 'gps.noPings')
          : t(locale, 'gps.sharingNow').replace('{count}', String(sharing))}
      </p>
      <DispatcherMap pins={pins} />
    </div>
  );
}
