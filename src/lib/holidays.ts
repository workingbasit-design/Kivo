/**
 * Public-holiday helpers (server-only) — Canada only.
 *
 * Data: Nager.Date public holidays API (free, no key).
 * https://date.nager.at/api/v3/publicholidays/{year}/CA
 *
 * Offline / API-failure fallback: computed Canadian statutory lists
 * (see ./holidays/ca). Failures are silent: callers get [] and simply
 * show no badges.
 */

export type Holiday = { date: string; name: string }; // date: YYYY-MM-DD

type CacheEntry = { at: number; value: Holiday[] };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — holidays barely change

const UA = 'EveryJobApp/1.0 (schedule holidays)';

import { getCaHolidays } from './holidays/ca';

export async function getHolidays(
  year: number,
  _countryCode?: string | null,
  provinceCode?: string | null
): Promise<Holiday[]> {
  const countryCode = 'CA';
  const key = `${countryCode}:${provinceCode ?? ''}:${year}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let value: Holiday[] = [];
  try {
    const res = await fetch(`https://date.nager.at/api/v3/publicholidays/${year}/${countryCode}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const arr: unknown = await res.json();
      value = (Array.isArray(arr) ? arr : [])
        .map((h) => {
          const o = h as Record<string, unknown>;
          const date = typeof o.date === 'string' ? o.date : '';
          const name =
            typeof o.localName === 'string' && o.localName
              ? o.localName
              : typeof o.name === 'string'
                ? o.name
                : '';
          return { date, name };
        })
        .filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date) && h.name.length > 0);
    }
  } catch {
    value = [];
  }

  // Offline / API-failure fallback: computed Canadian statutory list, no network needed.
  if (value.length === 0) {
    value = getCaHolidays(year, provinceCode);
  }

  cache.set(key, { at: Date.now(), value });
  return value;
}
