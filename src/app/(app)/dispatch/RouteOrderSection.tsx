import { Card } from '@/components/kit';
import { geocodeAddress } from '@/lib/geofence';
import { orderStops, formatRouteDistance } from '@/lib/route-order';
import { t, type Locale } from '@/lib/i18n';

export type RouteOrderJob = {
  id: string;
  title: string;
  time: string | null;
  address: string | null;
  customerName: string;
};

const GEOCODE_RACE_MS = 3000;
const MAX_GEOCODED_STOPS = 25;

/**
 * Slice 9: suggested visit order for the dispatch day (server component).
 *
 * Jobs carry no stored coordinates, so addresses are geocoded here on the
 * server with the existing cached, never-throw Nominatim helper — never
 * in a client render path. Each address gets a 3s race cap so a slow
 * geocoder cannot hang the page; failures land the job in the unordered
 * section with a hint, never an error. Distinct addresses are geocoded
 * once per render, and the set is capped (a pathological day degrades
 * to unordered rather than firing dozens of lookups). Start point is
 * the shop address when it geocodes, else the earliest stop (orderStops
 * fallback). DISPLAY ONLY — nothing here rewrites jobs.
 */
export default async function RouteOrderSection({
  jobs,
  businessAddress,
  locale,
}: {
  jobs: RouteOrderJob[];
  businessAddress: string | null;
  locale: Locale;
}) {
  const T = (k: string) => t(locale, `dispatch.${k}`);

  const withAddress = jobs.filter((j) => (j.address ?? '').trim() !== '');
  const distinct = [...new Set(withAddress.map((j) => j.address!.trim().toLowerCase()))].slice(
    0,
    MAX_GEOCODED_STOPS
  );
  const coords = new Map<string, { lat: number; lng: number }>();
  await Promise.all(
    distinct.map(async (key) => {
      const original = withAddress.find((j) => j.address!.trim().toLowerCase() === key)!.address!;
      const raced = await Promise.race([
        geocodeAddress(original),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), GEOCODE_RACE_MS)),
      ]);
      if (raced) coords.set(key, { lat: raced.lat, lng: raced.lng });
    })
  );

  let start: { lat: number; lng: number } | null = null;
  if (businessAddress?.trim()) {
    const g = await Promise.race([
      geocodeAddress(businessAddress),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), GEOCODE_RACE_MS)),
    ]);
    if (g) start = { lat: g.lat, lng: g.lng };
  }

  const ordered = orderStops(
    jobs.map((j) => {
      const c = j.address ? coords.get(j.address.trim().toLowerCase()) : undefined;
      return { id: j.id, lat: c?.lat ?? null, lng: c?.lng ?? null, startTime: j.time };
    }),
    start
  );
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const visit = ordered.filter((o) => !o.unordered);
  const tail = ordered.filter((o) => o.unordered);

  return (
    <Card className="p-5">
      <h2 className="text-sm font-bold text-ink">{T('routeTitle')}</h2>
      <p className="text-xs text-ink-2 mt-1">{T('routeHint')}</p>
      {visit.length > 0 && (
        <ol className="mt-4 space-y-2">
          {visit.map((s) => {
            const j = byId.get(s.id)!;
            const dist = formatRouteDistance(s.distanceFromPrevMeters);
            return (
              <li key={s.id}>
                <a
                  href={`/jobs/${s.id}`}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 hover:border-line-strong"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-asphalt text-xs font-extrabold text-hero-ink">
                    {s.order}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{j.title}</span>
                    <span className="block truncate text-xs text-ink-2">{j.customerName}</span>
                  </span>
                  {dist && (
                    <span className="shrink-0 text-[11px] font-semibold text-ink-2">
                      {dist} {s.order === 1 && start ? T('routeFromShop') : T('routeFromPrev')}
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ol>
      )}
      {tail.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-bold text-ink">{T('routeUnorderedTitle')}</h3>
          <p className="text-xs text-ink-2 mt-0.5">{T('routeUnorderedHint')}</p>
          <ul className="mt-2 space-y-1.5">
            {tail.map((s) => {
              const j = byId.get(s.id)!;
              return (
                <li key={s.id}>
                  <a
                    href={`/jobs/${s.id}`}
                    className="flex items-center gap-3 rounded-xl border border-dashed border-line bg-surface px-3 py-2 hover:border-line-strong"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{j.title}</span>
                      <span className="block truncate text-xs text-ink-2">{j.customerName}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
