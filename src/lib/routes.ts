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
