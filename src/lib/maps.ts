/**
 * Real map services for Kivo route planning.
 *
 * SERVER-SIDE ONLY — import this module only from server components,
 * server actions, or API routes. It calls third-party free services:
 *
 * - Geocoding: OpenStreetMap Nominatim (free, no API key required)
 * - Driving distance/duration matrix + per-leg ETAs: OSRM public demo
 *   server (free, no API key required)
 *
 * Both services have fair-use limits. To respect them:
 * - Nominatim requests carry an identifying User-Agent and are throttled
 *   to at most one request per second (their published policy).
 * - OSRM table requests are capped at 50 coordinates per call.
 * - Every result is cached in-memory so repeat views cost nothing.
 *
 * Every exported function NEVER throws — on any failure (network error,
 * bad response, rate limit, blocked egress) it returns null and the
 * caller degrades gracefully.
 */

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface GeocodedPoint extends GeoPoint {
  displayName: string;
}

export interface OptimizedRoute {
  /** Visit order as indices into the input points array. */
  order: number[];
  /** Total driving distance of the optimized path, in kilometres. */
  totalKm: number;
  /** Total driving time of the optimized path, in minutes. */
  totalMinutes: number;
}

export interface RouteLeg {
  km: number;
  minutes: number;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OSRM_TABLE_URL = 'https://router.project-osrm.org/table/v1/driving';
const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving';

// Identifying User-Agent, as required by the Nominatim usage policy.
const USER_AGENT = 'KivoApp/1.0';
const ATTRIBUTION = 'Geocoding by OpenStreetMap (Nominatim), routing by OSRM. © OpenStreetMap contributors.';

const FETCH_TIMEOUT_MS = 12_000;
// OSRM public server fair-use: keep table requests small.
const MAX_POINTS = 50;
// Nominatim usage policy: maximum 1 request per second.
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const MAX_CACHE_ENTRIES = 2000;

const geocodeCache = new Map<string, GeocodedPoint | null>();
const matrixCache = new Map<string, { durations: number[][]; distances: number[][] }>();
const legCache = new Map<string, RouteLeg | null>();

function putBounded<K, V>(map: Map<K, V>, key: K, value: V): void {
  if (map.size >= MAX_CACHE_ENTRIES) map.clear();
  map.set(key, value);
}

/** fetch with a timeout that returns null instead of throwing. */
async function fetchJson(url: string, init?: RequestInit): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Geocoding (Nominatim)
// ---------------------------------------------------------------------------

// Serializes geocode requests so we never exceed 1 req/sec.
let geocodeChain: Promise<void> = Promise.resolve();
let lastGeocodeAt = 0;

function throttleGeocode(): Promise<void> {
  const run = geocodeChain.then(async () => {
    const wait = NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastGeocodeAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastGeocodeAt = Date.now();
  });
  geocodeChain = run.catch(() => undefined);
  return run;
}

function isFiniteCoord(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/**
 * Geocode a free-text address to latitude/longitude via Nominatim.
 * Returns null for empty addresses and on any failure. Never throws.
 */
export async function geocodeAddress(address: string): Promise<GeocodedPoint | null> {
  const key = address.trim().toLowerCase();
  if (!key) return null;
  const cached = geocodeCache.get(key);
  if (cached !== undefined) return cached;

  let result: GeocodedPoint | null = null;
  try {
    await throttleGeocode();
    const url = `${NOMINATIM_URL}?format=jsonv2&limit=1&q=${encodeURIComponent(address.trim())}`;
    const data = await fetchJson(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    const first = Array.isArray(data) ? data[0] : null;
    const lat = first ? parseFloat(String(first?.lat)) : NaN;
    const lon = first ? parseFloat(String(first?.lon)) : NaN;
    if (isFiniteCoord(lat, lon)) {
      result = {
        lat,
        lon,
        displayName: String(first?.display_name ?? address.trim()),
      };
    }
  } catch {
    result = null;
  }
  putBounded(geocodeCache, key, result);
  return result;
}

// ---------------------------------------------------------------------------
// Driving matrix (OSRM table API)
// ---------------------------------------------------------------------------

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

function coordsParam(points: GeoPoint[]): string {
  return points.map((p) => `${round5(p.lon)},${round5(p.lat)}`).join(';');
}

function validMatrix(
  data: unknown,
  n: number
): { durations: number[][]; distances: number[][] } | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { code?: string; durations?: unknown; distances?: unknown };
  if (d.code !== 'Ok') return null;
  const { durations, distances } = d;
  if (!Array.isArray(durations) || !Array.isArray(distances)) return null;
  if (durations.length !== n || distances.length !== n) return null;
  for (let i = 0; i < n; i++) {
    const dr = durations[i];
    const ds = distances[i];
    if (!Array.isArray(dr) || !Array.isArray(ds) || dr.length !== n || ds.length !== n) return null;
    for (let j = 0; j < n; j++) {
      if (typeof dr[j] !== 'number' || typeof ds[j] !== 'number') return null;
    }
  }
  return { durations: durations as number[][], distances: distances as number[][] };
}

async function distanceMatrix(
  points: GeoPoint[]
): Promise<{ durations: number[][]; distances: number[][] } | null> {
  const n = points.length;
  if (n === 0 || n > MAX_POINTS) return null;
  const key = coordsParam(points);
  const cached = matrixCache.get(key);
  if (cached) return cached;
  try {
    const url = `${OSRM_TABLE_URL}/${key}?annotations=duration,distance`;
    const data = await fetchJson(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    const matrix = validMatrix(data, n);
    if (matrix) putBounded(matrixCache, key, matrix);
    return matrix;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// TSP solver: nearest-neighbor + 2-opt (open path, no return to start)
// ---------------------------------------------------------------------------

function legCost(d: number[][], from: number, to: number): number {
  const v = d[from]?.[to];
  return typeof v === 'number' && Number.isFinite(v) ? v : 1e12;
}

function pathCost(order: number[], d: number[][]): number {
  let c = 0;
  for (let i = 1; i < order.length; i++) c += legCost(d, order[i - 1], order[i]);
  return c;
}

/**
 * Compute a visit order minimizing total travel time over a duration
 * matrix (seconds). Nearest-neighbor seeded from `start`, then 2-opt
 * improvement. Pure function — exported for testing.
 */
export function solveTspPath(durations: number[][], start = 0): number[] {
  const n = durations.length;
  if (n === 0) return [];
  if (n === 1) return [0];
  const s = start >= 0 && start < n ? start : 0;

  const visited = new Array<boolean>(n).fill(false);
  const order: number[] = [s];
  visited[s] = true;
  while (order.length < n) {
    const cur = order[order.length - 1];
    let best = -1;
    let bestCost = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const c = legCost(durations, cur, i);
      if (c < bestCost) {
        bestCost = c;
        best = i;
      }
    }
    if (best === -1) break;
    visited[best] = true;
    order.push(best);
  }
  // Append any unreachable leftovers in index order (shouldn't happen).
  for (let i = 0; i < n; i++) if (!visited[i]) order.push(i);

  // 2-opt improvement on the open path.
  let bestCost = pathCost(order, durations);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 200) {
    improved = false;
    for (let i = 1; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const candidate = [
          ...order.slice(0, i),
          ...order.slice(i, k + 1).reverse(),
          ...order.slice(k + 1),
        ];
        const c = pathCost(candidate, durations);
        if (c < bestCost - 1e-6) {
          order.splice(0, n, ...candidate);
          bestCost = c;
          improved = true;
        }
      }
    }
  }
  return order;
}

/**
 * Optimize the visit order for a set of points using real driving
 * times from OSRM. Returns the visit order (indices into `points`)
 * plus totals, or null on any failure / empty input. Never throws.
 */
export async function optimizeRoute(points: GeoPoint[]): Promise<OptimizedRoute | null> {
  try {
    const n = points.length;
    if (n === 0) return null;
    if (n === 1) return { order: [0], totalKm: 0, totalMinutes: 0 };
    if (n > MAX_POINTS) return null;

    const matrix = await distanceMatrix(points);
    if (!matrix) return null;

    const order = solveTspPath(matrix.durations, 0);
    let totalKm = 0;
    let totalMinutes = 0;
    for (let i = 1; i < order.length; i++) {
      totalKm += matrix.distances[order[i - 1]][order[i]] / 1000;
      totalMinutes += matrix.durations[order[i - 1]][order[i]] / 60;
    }
    return {
      order,
      totalKm: Math.round(totalKm * 10) / 10,
      totalMinutes: Math.round(totalMinutes),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Per-leg driving distance/ETA (OSRM route API)
// ---------------------------------------------------------------------------

/**
 * Driving distance (km) and ETA (minutes) between two points via OSRM.
 * Cached in-memory. Returns null on any failure. Never throws.
 */
export async function routeLeg(from: GeoPoint, to: GeoPoint): Promise<RouteLeg | null> {
  const key = `${round5(from.lon)},${round5(from.lat)}>${round5(to.lon)},${round5(to.lat)}`;
  const cached = legCache.get(key);
  if (cached !== undefined) return cached;

  let result: RouteLeg | null = null;
  try {
    const url =
      `${OSRM_ROUTE_URL}/${round5(from.lon)},${round5(from.lat)};` +
      `${round5(to.lon)},${round5(to.lat)}?overview=false&steps=false`;
    const data = await fetchJson(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    const route =
      data && typeof data === 'object'
        ? (data as { routes?: Array<{ distance?: unknown; duration?: unknown }> }).routes?.[0]
        : undefined;
    const distance = typeof route?.distance === 'number' ? route.distance : NaN;
    const duration = typeof route?.duration === 'number' ? route.duration : NaN;
    if (Number.isFinite(distance) && Number.isFinite(duration)) {
      result = {
        km: Math.round((distance / 1000) * 10) / 10,
        minutes: Math.round(duration / 60),
      };
    }
  } catch {
    result = null;
  }
  putBounded(legCache, key, result);
  return result;
}

export function mapsAttribution(): string {
  return ATTRIBUTION;
}
