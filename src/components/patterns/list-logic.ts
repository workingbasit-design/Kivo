/**
 * Pure list-screen logic, kept free of JSX so it can be unit-tested with the
 * existing `npm test` harness.
 *
 * The key invariant: filter-chip counts are COMPUTED from the rows, so they
 * always match the list by construction. Callers never hand-write counts.
 */

export interface PatternListRow {
  /** Filter ids this row belongs to; must include 'all'. */
  filterIds: string[];
}

export interface PatternListGroup<R extends PatternListRow = PatternListRow> {
  id: string;
  rows: R[];
}

/**
 * Count, per filter id, the rows belonging to it across every group.
 * Filter ids with no rows get 0.
 */
export function computeFilterCounts<G extends PatternListGroup>(
  groups: G[],
  filterIds: string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of filterIds) counts[id] = 0;
  for (const group of groups) {
    for (const row of group.rows) {
      for (const fid of row.filterIds) {
        if (fid in counts) counts[fid] += 1;
      }
    }
  }
  return counts;
}

/**
 * Groups restricted to rows matching the selected filter; groups left with
 * no rows are dropped. The group type (headings, meta, …) is preserved.
 */
export function visibleGroupsForFilter<G extends PatternListGroup>(
  groups: G[],
  filterId: string,
): G[] {
  return groups
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) => row.filterIds.includes(filterId)),
    }))
    .filter((group) => group.rows.length > 0);
}
