/**
 * Part 0 (dashboard rebuild): deterministic helpers for the demo business
 * seed (scripts/seed-demo.ts). Pure functions — covered by unit tests —
 * so screenshots taken from the demo business are reproducible.
 */

/** Mulberry32: small deterministic PRNG. Same seed => same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic pick from a non-empty array. */
export function seededPick<T>(rng: () => number, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('seededPick: empty array');
  return arr[Math.floor(rng() * arr.length)];
}

/** Deterministic integer in [min, max] (inclusive). */
export function seededInt(rng: () => number, min: number, max: number): number {
  if (max < min) throw new Error('seededInt: max < min');
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * "Today" in the America/Toronto business timezone, as { y, m, d }.
 * The dashboard seed always looks current because every date is derived
 * from this, never from a hardcoded calendar date.
 */
export function todayToronto(now: Date = new Date()): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get('year'), m: get('month'), d: get('day') };
}

/**
 * Convert a Toronto wall-clock time to a UTC Date for storage.
 *
 * The demo seed only spans roughly six months back and two weeks forward
 * from mid-October, which falls entirely inside Eastern Daylight Time
 * (UTC-4; DST 2026 runs Mar 8 – Nov 1). A fixed -4 offset is therefore
 * exact for every seeded timestamp. If the seed window ever widens past
 * a DST boundary, replace this with a proper zone lookup.
 */
export function torontoWallToUtc(
  y: number,
  m: number,
  d: number,
  hour: number,
  minute = 0
): Date {
  return new Date(Date.UTC(y, m - 1, d, hour + 4, minute, 0, 0));
}

/** Shift a Toronto calendar date by whole days, returning a UTC instant at 00:00 Toronto. */
export function torontoDatePlusDays(
  base: { y: number; m: number; d: number },
  days: number
): Date {
  const utcNoon = Date.UTC(base.y, base.m - 1, base.d, 12, 0, 0, 0);
  const shifted = new Date(utcNoon + days * 86400000);
  return torontoWallToUtc(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    0,
    0
  );
}
