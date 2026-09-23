/**
 * Revenue-by-service bucketing for reports: groups completed/paid jobs by
 * their price-book service name. Jobs with no linked service fall under the
 * provided "other" label (localized by the caller).
 *
 * Pure — no I/O, safe to import from src/lib/dashboard.ts and node:test.
 */

export interface ServiceRevenueRow {
  name: string;
  revenue: number;
  jobs: number;
}

export interface RevenueBucketInput {
  price: number | null;
  serviceName: string | null;
}

/** Statuses whose job value counts as revenue. */
export const REVENUE_STATUSES = ['COMPLETED', 'PAID'] as const;

/**
 * Sum completed/paid job prices per service name, sorted by revenue desc.
 * Rows with an empty service name go under `otherLabel`.
 */
export function bucketRevenueByService(
  jobs: RevenueBucketInput[],
  otherLabel: string
): ServiceRevenueRow[] {
  const byName = new Map<string, { revenue: number; jobs: number }>();
  for (const j of jobs) {
    const name = j.serviceName && j.serviceName.trim().length > 0 ? j.serviceName : otherLabel;
    const cur = byName.get(name) ?? { revenue: 0, jobs: 0 };
    cur.revenue += j.price ?? 0;
    cur.jobs += 1;
    byName.set(name, cur);
  }
  return [...byName.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue);
}
