/**
 * Weather helpers (server-only).
 *
 * Data: Open-Meteo forecast API (free, no key).
 * Location: geocoded via Nominatim (free, no key; requires a User-Agent).
 *
 * All functions are failure-safe: they return null / [] on any API error and
 * never throw, so the UI can silently hide weather when it is unavailable.
 */

export type DailyWeather = {
  highC: number;
  lowC: number;
  /** Max precipitation probability for the day, 0–100. */
  precipProb: number;
  /** Open-Meteo weathercode. */
  code: number;
};

export type GeoResult = { lat: number; lon: number; name: string };

type CacheEntry<T> = { at: number; value: T };

const weatherCache = new Map<string, CacheEntry<Map<string, DailyWeather | null>>>();
const WEATHER_TTL_MS = 60 * 60 * 1000; // ~1h

const geoCache = new Map<string, CacheEntry<GeoResult | null>>();
const GEO_TTL_MS = 24 * 60 * 60 * 1000; // 24h (locations rarely change)

const UA = 'EveryJobApp/1.0 (schedule weather)';

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Daily forecast for one date (YYYY-MM-DD). Returns null when the API fails
 * or has no data for the date (e.g. beyond the ~16-day forecast window).
 */
export async function getDailyWeather(
  lat: number,
  lon: number,
  dateISO: string,
): Promise<DailyWeather | null> {
  const all = await getWeatherForDates(lat, lon, [dateISO]);
  return all.get(dateISO) ?? null;
}

/**
 * Daily forecasts for several dates with a single API call.
 * Missing dates map to null. Never throws.
 */
export async function getWeatherForDates(
  lat: number,
  lon: number,
  datesISO: string[],
): Promise<Map<string, DailyWeather | null>> {
  const dates = [...new Set(datesISO)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const out = new Map<string, DailyWeather | null>();
  if (dates.length === 0) return out;

  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const now = Date.now();
  const hit = weatherCache.get(key);
  const fresh = hit && now - hit.at < WEATHER_TTL_MS ? hit.value : null;
  const missing = fresh ? dates.filter((d) => !fresh.has(d)) : dates;
  if (fresh) for (const d of dates) if (fresh.has(d)) out.set(d, fresh.get(d) ?? null);
  if (missing.length === 0) return out;

  try {
    const start = missing[0];
    const end = missing[missing.length - 1];
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode` +
      `&timezone=auto&start_date=${start}&end_date=${end}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: withTimeout(8000) });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const data: unknown = await res.json();
    const daily = (data as { daily?: Record<string, unknown> })?.daily;
    const times = Array.isArray(daily?.time) ? (daily!.time as unknown[]) : [];
    const maxs = Array.isArray(daily?.temperature_2m_max) ? (daily!.temperature_2m_max as unknown[]) : [];
    const mins = Array.isArray(daily?.temperature_2m_min) ? (daily!.temperature_2m_min as unknown[]) : [];
    const probs = Array.isArray(daily?.precipitation_probability_max)
      ? (daily!.precipitation_probability_max as unknown[])
      : [];
    const codes = Array.isArray(daily?.weathercode) ? (daily!.weathercode as unknown[]) : [];

    const fetched = new Map<string, DailyWeather | null>();
    for (const d of missing) {
      const i = times.findIndex((t) => t === d);
      if (i === -1) {
        fetched.set(d, null);
        continue;
      }
      const high = num(maxs[i]);
      const low = num(mins[i]);
      const prob = num(probs[i]);
      const code = num(codes[i]);
      fetched.set(
        d,
        high === null || low === null
          ? null
          : {
              highC: Math.round(high),
              lowC: Math.round(low),
              precipProb: prob === null ? 0 : Math.max(0, Math.min(100, Math.round(prob))),
              code: code === null ? 3 : Math.round(code),
            },
      );
    }
    const merged = new Map(fresh ?? []);
    for (const [d, w] of fetched) merged.set(d, w);
    weatherCache.set(key, { at: now, value: merged });
    for (const d of dates) out.set(d, merged.get(d) ?? null);
  } catch {
    // Cache the miss briefly so a failing API isn't hammered on every render.
    for (const d of missing) out.set(d, null);
    const merged = new Map(fresh ?? []);
    for (const d of missing) merged.set(d, null);
    weatherCache.set(key, { at: now, value: merged });
  }
  return out;
}

/**
 * Geocode a free-text location (city/address) via Nominatim.
 * Returns null on any failure or when nothing matches. Results cached 24h.
 */
export async function geocodeLocation(query: string): Promise<GeoResult | null> {
  const q = query.trim();
  if (!q) return null;
  const key = q.toLowerCase();
  const hit = geoCache.get(key);
  if (hit && Date.now() - hit.at < GEO_TTL_MS) return hit.value;

  let value: GeoResult | null = null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: withTimeout(8000) });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const arr: unknown = await res.json();
    const first = Array.isArray(arr) ? (arr[0] as Record<string, unknown> | undefined) : undefined;
    const lat = first ? num(first.lat) : null;
    const lon = first ? num(first.lon) : null;
    if (lat !== null && lon !== null) {
      value = { lat, lon, name: typeof first!.display_name === 'string' ? first!.display_name : q };
    }
  } catch {
    value = null;
  }
  geoCache.set(key, { at: Date.now(), value });
  return value;
}

/** Map an Open-Meteo weathercode to a short human label. */
export function weatherLabel(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1 || code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'Rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Snow';
  if (code >= 95) return 'Thunderstorm';
  return 'Cloudy';
}
