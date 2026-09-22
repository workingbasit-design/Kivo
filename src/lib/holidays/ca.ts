/**
 * Canadian statutory holidays — pure, dependency-free date computation.
 *
 * Covers federal holidays plus the major provincial/territorial statutory
 * holidays. Used by the scheduler to badge days off, and as the offline
 * fallback when the Nager.Date API is unreachable.
 *
 * Sources: Government of Canada statutory holidays; provincial employment
 * standards (Family Day, Victoria Day, St-Jean-Baptiste, etc.).
 */

export type CaHoliday = {
  /** YYYY-MM-DD */
  date: string;
  name: string;
  /** 'federal' or province/territory code the holiday is specific to */
  scope: 'federal' | string;
};

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Nth weekday of a month: weekday 0=Sun..6=Sat, n>=1. */
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return ymd(year, month, 1 + offset + (n - 1) * 7);
}

/** Last weekday of a month: weekday 0=Sun..6=Sat. */
function lastWeekday(year: number, month: number, weekday: number): string {
  const last = new Date(Date.UTC(year, month, 0)); // day 0 of next month
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return ymd(year, month, last.getUTCDate() - offset);
}

/** Victoria Day: Monday on or before May 24. */
function victoriaDay(year: number): string {
  const may24 = new Date(Date.UTC(year, 4, 24));
  const offset = (may24.getUTCDay() - 1 + 7) % 7; // days back to Monday
  return ymd(year, 5, 24 - offset);
}

/** Good Friday: Friday before Easter Sunday (Anonymous Gregorian algorithm). */
function goodFriday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(Date.UTC(year, month - 1, day));
  const friday = new Date(easter.getTime() - 2 * 24 * 3600 * 1000);
  return ymd(friday.getUTCFullYear(), friday.getUTCMonth() + 1, friday.getUTCDate());
}

/** Easter Monday: Monday after Easter Sunday. */
function easterMonday(year: number): string {
  const gf = goodFriday(year); // YYYY-MM-DD of the Friday
  const [y, m, d] = gf.split('-').map(Number);
  const monday = new Date(Date.UTC(y, m - 1, d + 3));
  return ymd(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
}

/** Federal statutory holidays (also observed in most provinces). */
function federalHolidays(year: number): CaHoliday[] {
  const H = (date: string, name: string): CaHoliday => ({ date, name, scope: 'federal' });
  return [
    H(ymd(year, 1, 1), "New Year's Day"),
    H(goodFriday(year), 'Good Friday'),
    H(victoriaDay(year), 'Victoria Day'),
    H(ymd(year, 7, 1), 'Canada Day'),
    H(nthWeekday(year, 9, 1, 1), 'Labour Day'),
    H(ymd(year, 9, 30), 'National Day for Truth and Reconciliation'),
    H(nthWeekday(year, 10, 1, 2), 'Thanksgiving'),
    H(ymd(year, 11, 11), 'Remembrance Day'),
    H(ymd(year, 12, 25), 'Christmas Day'),
    H(ymd(year, 12, 26), 'Boxing Day'),
  ];
}

/**
 * Provincial/territorial additions. Keyed by province code; each entry is a
 * list of [name, date] computed for the year.
 */
function provincialHolidays(year: number): Record<string, [string, string][]> {
  const thirdMonFeb = nthWeekday(year, 2, 1, 3);
  const firstMonAug = nthWeekday(year, 8, 1, 1);
  return {
    ON: [
      ['Family Day', thirdMonFeb],
      ['Civic Holiday', firstMonAug],
    ],
    QC: [
      ["National Patriots' Day", nthWeekday(year, 5, 1, 3)],
      ['Saint-Jean-Baptiste Day', ymd(year, 6, 24)],
    ],
    BC: [
      ['Family Day', thirdMonFeb],
      ['British Columbia Day', firstMonAug],
    ],
    AB: [
      ['Family Day', thirdMonFeb],
      ['Heritage Day', firstMonAug],
    ],
    SK: [['Family Day', thirdMonFeb]],
    MB: [
      ['Louis Riel Day', thirdMonFeb],
      ['Terry Fox Day', firstMonAug],
    ],
    NB: [['New Brunswick Day', firstMonAug]],
    NS: [
      ['Heritage Day', thirdMonFeb],
      ['Natal Day', firstMonAug],
    ],
    PE: [
      ['Islander Day', thirdMonFeb],
      // Gold Cup Parade Day: third Friday of August
      ['Gold Cup Parade Day', nthWeekday(year, 8, 5, 3)],
    ],
    NL: [
      ["St. Patrick's Day", ymd(year, 3, 17)],
      ["St. George's Day", ymd(year, 4, 23)],
      ['Discovery Day', ymd(year, 6, 24)],
      ["Orangemen's Day", ymd(year, 7, 12)],
      // Royal St. John's Regatta: first Wednesday of August
      ["Royal St. John's Regatta", nthWeekday(year, 8, 3, 1)],
    ],
    NT: [['National Indigenous Peoples Day', ymd(year, 6, 21)]],
    NU: [['National Indigenous Peoples Day', ymd(year, 6, 21)]],
    YT: [
      ['National Indigenous Peoples Day', ymd(year, 6, 21)],
      ['Discovery Day', nthWeekday(year, 8, 1, 3)],
    ],
  };
}

/**
 * All statutory holidays for a year: federal + the given province/territory.
 * Pass no province (or an unknown code) for federal-only.
 * Sorted by date, de-duplicated by date (provincial entries win ties).
 */
export function getCaHolidays(year: number, provinceCode?: string | null): CaHoliday[] {
  const federal = federalHolidays(year);
  const prov = provinceCode ? provincialHolidays(year)[provinceCode.toUpperCase()] : undefined;

  const byDate = new Map<string, CaHoliday>();
  for (const h of federal) byDate.set(h.date, h);
  if (prov) {
    for (const [name, date] of prov) {
      if (!date) continue;
      byDate.set(date, {
        date,
        name,
        scope: provinceCode!.toUpperCase(),
      });
    }
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Quick check used by the scheduler: is this YYYY-MM-DD a holiday? */
export function isCaHoliday(date: string, year: number, provinceCode?: string | null): boolean {
  return getCaHolidays(year, provinceCode).some((h) => h.date === date);
}

/** Province/territory codes with their own statutory holidays in this list. */
export const CA_HOLIDAY_PROVINCES = [
  'ON', 'QC', 'BC', 'AB', 'SK', 'MB', 'NB', 'NS', 'PE', 'NL', 'NT', 'NU', 'YT',
] as const;
