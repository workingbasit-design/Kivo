/**
 * Driving distance + ETA helpers for the customer live-tracking page.
 *
 * Routing comes from the public OSRM demo server (OpenStreetMap-based,
 * free, no API key). Everything here is best-effort and NEVER throws:
 * when routing is unavailable the UI falls back to straight-line distance
 * from `haversineMeters`, and when that is unavailable the chips hide.
 */

import { haversineMeters } from './geofence.ts';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const OSRM_CACHE_TTL_MS = 60 * 1000; // 1 minute — pings move fast
const OSRM_TIMEOUT_MS = 8_000;

export interface DrivingEta {
  /** Road distance in metres. */
  distanceM: number;
  /** Travel time in seconds. */
  durationS: number;
}

interface CacheEntry {
  value: DrivingEta | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): string {
  // Round so near-identical pings share cache entries.
  return [fromLat, fromLng, toLat, toLng]
    .map((n) => n.toFixed(4))
    .join(',');
}

/**
 * Driving distance + duration between two points via OSRM.
 * Returns null on any failure (network, timeout, bad response) — never throws.
 */
export async function fetchDrivingEta(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<DrivingEta | null> {
  if (
    ![fromLat, fromLng, toLat, toLng].every((n) => Number.isFinite(n))
  ) {
    return null;
  }
  const key = cacheKey(fromLat, fromLng, toLat, toLng);
  const hit = cache.get(key);
  if (hit && Date.now() <= hit.expiresAt) return hit.value;
  if (hit) cache.delete(key);

  try {
    const url =
      `${OSRM_BASE}/${fromLng},${fromLat};${toLng},${toLat}` +
      '?overview=false';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'EveryJobApp/1.0 (customer tracking ETA)' },
      signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
    });
    if (!res.ok) {
      cache.set(key, { value: null, expiresAt: Date.now() + OSRM_CACHE_TTL_MS });
      return null;
    }
    const data = (await res.json()) as {
      routes?: { distance?: number; duration?: number }[];
    };
    const route = data.routes?.[0];
    const value =
      route &&
      Number.isFinite(route.distance) &&
      Number.isFinite(route.duration) &&
      (route.distance as number) > 0
        ? {
            distanceM: route.distance as number,
            durationS: route.duration as number,
          }
        : null;
    if (cache.size > 500) cache.clear();
    cache.set(key, { value, expiresAt: Date.now() + OSRM_CACHE_TTL_MS });
    return value;
  } catch {
    cache.set(key, { value: null, expiresAt: Date.now() + OSRM_CACHE_TTL_MS });
    return null;
  }
}

/** Straight-line distance in metres — always available, no network needed. */
export function straightLineMeters(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number | null {
  if (
    ![fromLat, fromLng, toLat, toLng].every((n) => Number.isFinite(n))
  ) {
    return null;
  }
  return haversineMeters(fromLat, fromLng, toLat, toLng);
}

/**
 * Human-friendly distance: "850 m" under 1 km, "2.4 km" above.
 * Locale-aware number formatting (2,4 km in fr-CA).
 */
export function formatDistance(meters: number, locale: string): string {
  const tag = locale === 'fr' ? 'fr-CA' : 'en-CA';
  if (!Number.isFinite(meters) || meters < 0) return '';
  if (meters < 1000) {
    const m = Math.round(meters / 10) * 10;
    return `${m.toLocaleString(tag)} m`;
  }
  const km = meters / 1000;
  const rounded = km >= 10 ? Math.round(km) : Math.round(km * 10) / 10;
  return `${rounded.toLocaleString(tag, { maximumFractionDigits: 1 })} km`;
}

/**
 * Human-friendly ETA: "~9 min", "~1 h 5 min". Rounds to whole minutes.
 */
export function formatEta(seconds: number, locale: string): string {
  const tag = locale === 'fr' ? 'fr-CA' : 'en-CA';
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) {
    return `~${mins.toLocaleString(tag)} ${locale === 'fr' ? 'min' : 'min'}`;
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hStr = h.toLocaleString(tag);
  if (m === 0) return `~${hStr} h`;
  return `~${hStr} h ${m.toLocaleString(tag)} ${locale === 'fr' ? 'min' : 'min'}`;
}
