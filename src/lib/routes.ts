/**
 * Route planner shared types.
 *
 * Visit ordering is computed with REAL driving data (see src/lib/maps.ts
 * for Nominatim geocoding + OSRM driving times, and
 * src/lib/route-optimizer.ts for the day-route flow). The manual
 * up/down reordering in the UI still works on top of any optimized order.
 */

export interface RouteStop {
  id: string;
  title: string;
  customerName: string;
  address: string | null;
  time: string | null;
  price: number;
  status: string;
  /** Driving distance (km) from the previous stop — set after route optimization. */
  legKm?: number | null;
  /** Driving ETA (minutes) from the previous stop — set after route optimization. */
  legMinutes?: number | null;
}

/**
 * Parse a "hh:mm AM/PM" (or "HH:MM") time string to minutes since midnight.
 * Returns null when it can't be parsed.
 */
export function parseTimeToMinutes(time: string | null): number | null {
  if (!time) return null;
  const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*([aApP][mM])?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const meridiem = m[3]?.toUpperCase();
  if (meridiem === 'PM' && h < 12) h += 12;
  if (meridiem === 'AM' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Build a Google Maps directions URL covering every stop that has an
 * address, in the given visit order. Stops with blank/missing addresses
 * are skipped. Returns null when no stop has an address (nothing to map).
 *
 * Single addressed stop → a plain destination link. Multiple →
 * origin = first stop, destination = last stop, the rest as waypoints.
 * Pure and unit-tested; the Routes page passes the current stop order
 * straight in, so the link always matches what the user sees.
 */
export function googleMapsRouteUrl(
  stops: { address: string | null | undefined }[]
): string | null {
  const addrs = stops
    .map((s) => (s.address ?? '').trim())
    .filter((a) => a.length > 0);
  if (addrs.length === 0) return null;

  const enc = (a: string) => encodeURIComponent(a);
  if (addrs.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&destination=${enc(addrs[0])}`;
  }
  const origin = enc(addrs[0]);
  const destination = enc(addrs[addrs.length - 1]);
  const waypoints = addrs
    .slice(1, -1)
    .map(enc)
    .join('|');
  const wp = waypoints ? `&waypoints=${waypoints}` : '';
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${wp}`;
}
