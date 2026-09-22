/**
 * Public-holiday helpers (server-only).
 *
 * Data: Nager.Date public holidays API (free, no key).
 * https://date.nager.at/api/v3/publicholidays/{year}/{countryCode}
 *
 * Note: Nager.Date does not publish Indian holidays, so for region IN we fall
 * back to India's three fixed-date national holidays. Everything else comes
 * from the API. Failures are silent: callers get [] and simply show no badges.
 */

export type Holiday = { date: string; name: string }; // date: YYYY-MM-DD

type CacheEntry = { at: number; value: Holiday[] };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — holidays barely change

const UA = 'KivoApp/1.0 (schedule holidays)';

/** India's fixed-date national holidays (no API coverage for IN). */
function indiaFixedHolidays(year: number): Holiday[] {
  return [
    { date: `${year}-01-26`, name: 'Republic Day' },
    { date: `${year}-08-15`, name: 'Independence Day' },
    { date: `${year}-10-02`, name: 'Gandhi Jayanti' },
  ];
}

export async function getHolidays(year: number, countryCode: 'IN' | 'CA'): Promise<Holiday[]> {
  const key = `${countryCode}:${year}`;
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

  // Nager.Date has no India data — use the fixed national holidays instead.
  if (countryCode === 'IN' && value.length === 0) {
    value = indiaFixedHolidays(year);
  }

  cache.set(key, { at: Date.now(), value });
  return value;
}
