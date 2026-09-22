/**
 * Day-route optimization core.
 *
 * Server-side only. Kept separate from the server action so the logic can
 * be exercised without an auth session (the action in
 * src/app/actions/routes.ts adds requireAuth + rate limiting on top).
 *
 * Flow for a given business + day:
 *  1. Load the day's SCHEDULED / IN PROGRESS jobs with addresses.
 *  2. Geocode each unique address via Nominatim (cached, 1 req/sec).
 *  3. Jobs with no address — or whose address could not be geocoded —
 *     are returned separately as `unlocated`.
 *  4. Located stops are optimized with real OSRM driving times
 *     (nearest-neighbor + 2-opt), seeded from the earliest appointment
 *     so the route starts at the first scheduled stop.
 *  5. Each consecutive leg gets a real driving distance/ETA via OSRM.
 */

import { prisma } from '@/lib/prisma';
import { dayRange } from '@/lib/utils';
import {
  geocodeAddress,
  optimizeRoute,
  routeLeg,
  mapsAttribution,
  type GeocodedPoint,
} from './maps';
import { parseTimeToMinutes, type RouteStop } from './routes';

const ROUTE_STATUSES = ['SCHEDULED', 'IN PROGRESS'];

export interface OptimizedStop extends RouteStop {
  lat: number | null;
  lon: number | null;
  /** Geocoded display name from Nominatim (may differ from the typed address). */
  displayName: string | null;
  /** Driving distance from the previous stop in the optimized order. */
  legKm: number | null;
  /** Driving ETA from the previous stop in minutes. */
  legMinutes: number | null;
}

export interface DayRouteResult {
  stops: OptimizedStop[];
  /** Jobs that had no address or whose address could not be geocoded. */
  unlocated: RouteStop[];
  totalKm: number | null;
  totalMinutes: number | null;
  geocodedCount: number;
  attribution: string;
}

function toRouteStop(j: {
  id: string;
  title: string;
  address: string | null;
  time: string | null;
  price: number;
  status: string;
  customer: { name: string };
}): RouteStop {
  return {
    id: j.id,
    title: j.title,
    customerName: j.customer.name,
    address: j.address,
    time: j.time,
    price: j.price,
    status: j.status,
  };
}

export async function optimizeDayRouteForBusiness(
  businessId: string,
  dateStr: string
): Promise<DayRouteResult> {
  const { gte, lte } = dayRange(dateStr);

  const jobs = await prisma.job.findMany({
    where: {
      businessId,
      date: { gte, lte },
      status: { in: ROUTE_STATUSES },
    },
    include: { customer: { select: { name: true } } },
    orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
  });

  const baseStops = jobs.map(toRouteStop);

  // Geocode each unique non-empty address once (cache + throttle inside).
  const uniqueAddresses = [
    ...new Set(
      baseStops
        .map((s) => (s.address ?? '').trim())
        .filter((a) => a.length > 0)
    ),
  ];
  const geoByAddress = new Map<string, GeocodedPoint | null>();
  for (const addr of uniqueAddresses) {
    geoByAddress.set(addr, await geocodeAddress(addr));
  }

  const located: Array<RouteStop & { lat: number; lon: number; displayName: string }> = [];
  const unlocated: RouteStop[] = [];
  for (const s of baseStops) {
    const addr = (s.address ?? '').trim();
    const g = addr ? geoByAddress.get(addr) ?? null : null;
    if (g) {
      located.push({ ...s, lat: g.lat, lon: g.lon, displayName: g.displayName });
    } else {
      unlocated.push(s);
    }
  }

  // Seed the route at the earliest appointment (null times go last).
  const seeded = [...located].sort(
    (a, b) => (parseTimeToMinutes(a.time) ?? 1e9) - (parseTimeToMinutes(b.time) ?? 1e9)
  );

  const opt = await optimizeRoute(seeded.map((p) => ({ lat: p.lat, lon: p.lon })));

  let stops: OptimizedStop[];
  let totalKm: number | null = null;
  let totalMinutes: number | null = null;

  if (!opt || seeded.length <= 1) {
    stops = seeded.map((s) => ({
      ...s,
      legKm: null,
      legMinutes: null,
    }));
  } else {
    const ordered = opt.order.map((i) => seeded[i]);
    const legs: Array<{ km: number; minutes: number } | null> = [null];
    for (let i = 1; i < ordered.length; i++) {
      legs.push(await routeLeg(ordered[i - 1], ordered[i]));
    }

    const allLegsOk = legs.slice(1).every((l) => l !== null);
    if (allLegsOk) {
      totalKm = Math.round(legs.slice(1).reduce((s, l) => s + (l?.km ?? 0), 0) * 10) / 10;
      totalMinutes = Math.round(legs.slice(1).reduce((s, l) => s + (l?.minutes ?? 0), 0));
    } else {
      // Fall back to matrix totals when a per-leg lookup failed.
      totalKm = opt.totalKm;
      totalMinutes = opt.totalMinutes;
    }

    stops = ordered.map((s, i) => ({
      ...s,
      legKm: legs[i]?.km ?? null,
      legMinutes: legs[i]?.minutes ?? null,
    }));
  }

  return {
    stops,
    unlocated,
    totalKm,
    totalMinutes,
    geocodedCount: located.length,
    attribution: mapsAttribution(),
  };
}
