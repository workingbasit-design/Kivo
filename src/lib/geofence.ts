/**
 * Privacy-first geofencing helpers for EveryJob GPS tracking.
 *
 * Design notes:
 * - Pure math (haversine) is fully unit-tested; network access is isolated in
 *   the geocoders below, which NEVER throw — they return null when the lookup
 *   fails so arrival detection degrades gracefully instead of blocking.
 * - Nominatim (OpenStreetMap) is free with no API key. Its usage policy
 *   requires a descriptive User-Agent; results are cached in memory to stay
 *   well under the rate limits.
 * - `pruneStaleLocationPings` is imported lazily so this module stays
 *   side-effect free for unit tests (no Prisma client at import time).
 */

export const EARTH_RADIUS_M = 6_371_000;

/** Arrival is declared when the tech is within ~150 m of the job address. */
export const ARRIVAL_RADIUS_M = 150;

/** Pings older than this are pruned by the nightly cron. */
export const PING_RETENTION_HOURS = 24;

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'EveryJobApp/1.0 (gps arrival detection)';
const GEOCODE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ArrivalResult {
  arrived: boolean;
  /** Straight-line distance in metres from the tech to the job site. */
  distanceM: number;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in metres between two coordinates. */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** True when the two points are within `radiusMeters` of each other. */
export function isWithinRadius(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  radiusMeters: number
): boolean {
  if (!Number.isFinite(radiusMeters) || radiusMeters < 0) return false;
  return haversineMeters(lat1, lng1, lat2, lng2) <= radiusMeters;
}

/**
 * Arrival check against an already-geocoded destination.
 * Returns null when either coordinate is invalid — never throws.
 */
export function detectArrival(
  tech: GeoPoint,
  destination: GeoPoint,
  radiusMeters: number = ARRIVAL_RADIUS_M
): ArrivalResult | null {
  if (
    !Number.isFinite(tech.lat) ||
    !Number.isFinite(tech.lng) ||
    !Number.isFinite(destination.lat) ||
    !Number.isFinite(destination.lng)
  ) {
    return null;
  }
  const distanceM = haversineMeters(tech.lat, tech.lng, destination.lat, destination.lng);
  return { arrived: distanceM <= radiusMeters, distanceM };
}

// ── Nominatim geocoding (graceful, cached) ────────────────────────────────

interface CacheEntry {
  value: { lat: number; lng: number; displayName: string } | null;
  expiresAt: number;
}

const geocodeCache = new Map<string, CacheEntry>();

function cacheGet(key: string): CacheEntry['value'] | undefined {
  const hit = geocodeCache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    geocodeCache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key: string, value: CacheEntry['value']): void {
  // Bound the cache so a long-lived server never grows it without limit.
  if (geocodeCache.size > 2000) geocodeCache.clear();
  geocodeCache.set(key, { value, expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS });
}

/** Round coordinates so cache keys are stable for near-identical pings. */
export function cacheKeyForPoint(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

async function nominatimFetch(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    // Network down, timeout, blocked — arrival detection is best-effort.
    return null;
  }
}

/**
 * Forward-geocode a street address to coordinates. Returns null when the
 * address is empty or the lookup fails — callers must skip arrival detection
 * in that case rather than erroring.
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const q = address.trim();
  if (!q) return null;
  const key = `fwd:${q.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  const url =
    `${NOMINATIM_BASE}/search?` +
    new URLSearchParams({
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'ca',
      q,
    }).toString();
  const data = await nominatimFetch(url);
  const first = Array.isArray(data) ? data[0] : null;
  const parsed =
    first && Number.isFinite(Number(first.lat)) && Number.isFinite(Number(first.lon))
      ? {
          lat: Number(first.lat),
          lng: Number(first.lon),
          displayName: String(first.display_name ?? q),
        }
      : null;
  cacheSet(key, parsed);
  return parsed;
}

/**
 * Reverse-geocode a ping to a human-readable place label (city / road).
 * Best-effort: returns null on any failure.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ displayName: string } | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const key = `rev:${cacheKeyForPoint(lat, lng)}`;
  const cached = cacheGet(key);
  if (cached !== undefined) {
    return cached ? { displayName: cached.displayName } : null;
  }

  const url =
    `${NOMINATIM_BASE}/reverse?` +
    new URLSearchParams({
      format: 'jsonv2',
      zoom: '16',
      lat: String(lat),
      lon: String(lng),
    }).toString();
  const data = await nominatimFetch(url);
  const parsed =
    data && typeof data === 'object' && 'display_name' in data
      ? { lat, lng, displayName: String((data as { display_name: unknown }).display_name) }
      : null;
  cacheSet(key, parsed);
  return parsed ? { displayName: parsed.displayName } : null;
}

/**
 * Full arrival check: geocode the job address, then compare with the tech's
 * ping. Returns null when the address can't be geocoded (skip gracefully).
 */
export async function checkArrival(
  techLat: number,
  techLng: number,
  jobAddress: string | null | undefined,
  radiusMeters: number = ARRIVAL_RADIUS_M
): Promise<ArrivalResult | null> {
  if (!jobAddress) return null;
  const dest = await geocodeAddress(jobAddress);
  if (!dest) return null;
  return detectArrival({ lat: techLat, lng: techLng }, dest, radiusMeters);
}

/**
 * Delete TechnicianLocation pings older than `maxAgeHours` (default 24h).
 * Called from the nightly cron. Returns the number of rows removed.
 */
export async function pruneStaleLocationPings(
  maxAgeHours: number = PING_RETENTION_HOURS
): Promise<number> {
  const { prisma } = await import('@/lib/prisma');
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  const res = await prisma.technicianLocation.deleteMany({
    where: { recordedAt: { lt: cutoff } },
  });
  return res.count;
}
