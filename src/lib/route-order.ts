/**
 * Slice 9 — dispatch route stop ordering (pure).
 *
 * Greedy nearest-neighbor visit order for a day's jobs: start at the
 * given point (the shop, or a technician's last location), then always
 * go to the nearest unvisited stop. Deliberately a heuristic, not
 * optimal — O(n²) with n = a day's jobs (small). A 2-opt pass is a v2
 * improvement only if a real day shows bad orderings.
 *
 * - Stops without coordinates cannot be ordered by distance: they go
 *   last, in scheduled-start-time order, flagged `unordered`.
 * - Ties break by scheduled start time (earlier first), then by id —
 *   the output is fully deterministic for fixed inputs.
 * - No Date.now, no I/O: the caller supplies coordinates (geocoded
 *   server-side, cached, best-effort) and the start point.
 * - DISPLAY ONLY: ordering never rewrites job times, assignments, or
 *   dates. A saved manual order, if one ever exists, overrides this
 *   suggestion (no manual order exists in v1).
 */
import { haversineMeters } from './geofence.ts';

export type RouteStopInput = {
  id: string;
  /** Coordinates when known (geocoded address); absent = unordered. */
  lat?: number | null;
  lng?: number | null;
  /** Scheduled start time for tie-breaking ("10:00 AM" or ISO). */
  startTime?: string | null;
};

export type OrderedStop = RouteStopInput & {
  /** 1-based visit position among ORDERED stops; null when unordered. */
  order: number | null;
  /**
   * Metres from the previous point on the route: the start point for
   * the first stop when a start is given, else the previous stop.
   * Null for the first stop without a start, and for unordered stops.
   */
  distanceFromPrevMeters: number | null;
  /** True when the stop has no coordinates and sits in the tail. */
  unordered: boolean;
};

function hasCoords(s: RouteStopInput): s is RouteStopInput & { lat: number; lng: number } {
  return (
    s.lat != null &&
    s.lng != null &&
    Number.isFinite(s.lat) &&
    Number.isFinite(s.lng)
  );
}

function timeKey(s: RouteStopInput): string {
  return s.startTime ?? '';
}

/**
 * Order stops for a route. `start` is the depot (shop address) or a
 * technician's last location; when absent, the first stop is the
 * earliest-start-time coordinated stop, then greedy from there.
 */
export function orderStops(
  stops: RouteStopInput[],
  start?: { lat: number; lng: number } | null
): OrderedStop[] {
  const ordered: RouteStopInput[] = [];
  const unordered: RouteStopInput[] = [];
  for (const s of stops) {
    (hasCoords(s) ? ordered : unordered).push(s);
  }
  // Unordered tail: scheduled-start-time order, then id.
  unordered.sort(
    (a, b) => timeKey(a).localeCompare(timeKey(b)) || a.id.localeCompare(b.id)
  );

  const remaining = [...ordered];
  const visit: OrderedStop[] = [];
  let from: { lat: number; lng: number } | null =
    start && Number.isFinite(start.lat) && Number.isFinite(start.lng) ? start : null;

  // No start point: seed with the earliest coordinated stop.
  if (!from && remaining.length > 0) {
    remaining.sort(
      (a, b) => timeKey(a).localeCompare(timeKey(b)) || a.id.localeCompare(b.id)
    );
    const first = remaining.shift()!;
    visit.push({ ...first, order: 1, distanceFromPrevMeters: null, unordered: false });
    from = { lat: first.lat!, lng: first.lng! };
  }

  while (remaining.length > 0 && from) {
    let bestIdx = 0;
    let bestDist = Infinity;
    let bestTime = '';
    let bestId = '';
    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i];
      const d = haversineMeters(from.lat, from.lng, s.lat!, s.lng!);
      const tk = timeKey(s);
      if (
        d < bestDist ||
        (d === bestDist && (tk < bestTime || (tk === bestTime && s.id < bestId)))
      ) {
        bestIdx = i;
        bestDist = d;
        bestTime = tk;
        bestId = s.id;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    visit.push({
      ...next,
      order: visit.length + 1,
      distanceFromPrevMeters: Math.round(bestDist),
      unordered: false,
    });
    from = { lat: next.lat!, lng: next.lng! };
  }

  return [
    ...visit,
    ...unordered.map((s) => ({
      ...s,
      order: null,
      distanceFromPrevMeters: null,
      unordered: true,
    })),
  ];
}

/** Human distance for the ordered list: "350 m" / "1.2 km". */
export function formatRouteDistance(meters: number | null): string | null {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
