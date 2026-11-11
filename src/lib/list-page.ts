/**
 * M3: bounded list reads.
 *
 * The jobs, customers, invoices and quotes screens each fetched EVERY row
 * for the business and filtered in memory on the client ("one fetch for
 * everything: tab switching filters in memory"). That is fine at ten rows
 * and ruinous at ten thousand: the whole table is serialised into the RSC
 * payload on every page view, and it grows without limit.
 *
 * These screens keep their in-memory tab filtering - reworking that into
 * per-tab server queries would be a much larger change and is not needed to
 * bound the read. Instead each list fetches at most `limit` rows, newest
 * first, and the page offers "Show more" by raising ?limit= in the URL.
 * That keeps every row reachable (no silently truncated list), needs no
 * client state, and works without JavaScript.
 *
 * Headline totals are NOT derived from the fetched page - they are computed
 * by the database with aggregate()/groupBy(), so the numbers stay exact no
 * matter how few rows are on screen. Capping a list is safe; capping a sum
 * would quietly make it wrong.
 */

/** Rows fetched by default. */
export const LIST_PAGE_SIZE = 200;

/** Hard ceiling, so ?limit=999999999 cannot be used to force a full scan. */
export const LIST_MAX_SIZE = 2000;

/**
 * Read and clamp the ?limit= search param.
 * Anything missing, non-numeric or out of range falls back to the default.
 */
export function parseListLimit(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return LIST_PAGE_SIZE;
  return Math.min(n, LIST_MAX_SIZE);
}

/**
 * Take one more row than asked for: the extra row is how we know whether a
 * "Show more" link is warranted, without a second COUNT query.
 */
export function takeWithProbe(limit: number): number {
  return limit + 1;
}

export interface ListPageSlice<T> {
  /** At most `limit` rows. */
  rows: T[];
  /** True when the database held more rows than the limit. */
  hasMore: boolean;
  /** Limit to request next, or null when there is nothing more to show. */
  nextLimit: number | null;
}

/** Split a `takeWithProbe(limit)` result into the page plus a hasMore flag. */
export function sliceListPage<T>(rows: T[], limit: number): ListPageSlice<T> {
  const hasMore = rows.length > limit;
  return {
    rows: hasMore ? rows.slice(0, limit) : rows,
    hasMore,
    nextLimit: hasMore ? Math.min(limit + LIST_PAGE_SIZE, LIST_MAX_SIZE) : null,
  };
}
