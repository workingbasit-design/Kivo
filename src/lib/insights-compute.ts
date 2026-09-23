/**
 * Pure insight computations — deterministic functions of plain rows.
 * No DB, no network, no randomness. Imported by src/lib/insights.ts and
 * unit-tested in src/lib/__tests__/insights.test.mts.
 */

export interface RevenueTrendPoint {
  key: string;
  label: string;
  revenue: number;
}

export interface ServiceMargin {
  serviceId: string | null;
  name: string;
  jobs: number;
  revenue: number;
  costs: number;
  margin: number; // revenue - costs
  marginPct: number | null; // null when revenue is 0
}

export interface Insights {
  /** Last 6 months of collected revenue, oldest -> newest. */
  revenueTrend: RevenueTrendPoint[];
  /** Month-over-month change of the most recent complete month vs the one before, % or null. */
  revenueMomentumPct: number | null;
  /** Services ranked by margin (revenue - expenses), best first. */
  serviceMargins: ServiceMargin[];
  /** Average collected revenue per customer who has paid, and % of paying customers with 2+ paid jobs. */
  customerLifetimeValue: { avgValue: number; repeatRatePct: number | null; payingCustomers: number } | null;
  /** Demand by calendar month across all history (avg jobs per year for that month). */
  seasonalDemand: { month: string; jobs: number }[];
  /** Busiest weekday (0=Sun..6=Sat) across completed history, or null. */
  busiestWeekday: number | null;
  /** Avg job value by weekday — used for smart scheduling suggestions. */
  avgValueByWeekday: (number | null)[];
  /** SENT quotes older than 7 days — follow-up candidates. */
  staleQuotes: { id: string; number: string; customerName: string; total: number; daysWaiting: number }[];
  quoteWinRatePct: number | null;
  /** Technician utilization: completed+paid jobs per technician, best first. */
  technicians: { name: string; jobs: number; revenue: number }[];
  /** Rows of data backing the insights (jobs + payments + quotes considered). */
  basisJobs: number;
  basisPayments: number;
  basisQuotes: number;
}

const COMPLETED = ['COMPLETED', 'PAID'];

function monthLabel(d: Date, locale: 'en' | 'fr'): string {
  return d.toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short' });
}

/** Plain-data shapes the pure computation consumes (subset of the Prisma selects). */
export interface InsightPayment {
  amount: number;
  createdAt: Date;
}
export interface InsightJob {
  price: number | null;
  status: string;
  date: Date;
  customerId: string;
  technician: string | null;
  assignedTo: { name: string | null } | null;
  serviceId: string | null;
  service: { name: string } | null;
  expenses: { amount: number }[];
}
export interface InsightQuote {
  id: string;
  number: string;
  total: number;
  status: string;
  createdAt: Date;
  customer: { name: string };
}

/**
 * Pure computation: everything below is a deterministic function of the
 * given rows — no DB, no network, no randomness. Unit-tested in
 * src/lib/__tests__/insights.test.mts.
 */
export function computeInsights(
  payments: InsightPayment[],
  jobs: InsightJob[],
  quotes: InsightQuote[],
  locale: 'en' | 'fr' = 'en',
  now: Date = new Date()
): Insights {

  // --- Revenue trend (last 6 months) ---
  const revenueTrend: RevenueTrendPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    revenueTrend.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: monthLabel(d, locale),
      revenue: payments
        .filter((p) => p.createdAt >= start && p.createdAt <= end)
        .reduce((s, p) => s + p.amount, 0),
    });
  }
  let revenueMomentumPct: number | null = null;
  // Compare the most recent *complete* month against the one before it.
  const lastComplete = revenueTrend[revenueTrend.length - 2];
  const prevComplete = revenueTrend[revenueTrend.length - 3];
  if (lastComplete && prevComplete && prevComplete.revenue > 0) {
    revenueMomentumPct = Math.round(((lastComplete.revenue - prevComplete.revenue) / prevComplete.revenue) * 1000) / 10;
  }

  // --- Service margins (completed/paid jobs only; revenue from job price, costs from expenses) ---
  const byService = new Map<string, ServiceMargin>();
  for (const job of jobs) {
    if (!COMPLETED.includes(job.status)) continue;
    const key = job.serviceId ?? '__none__';
    const costs = job.expenses.reduce((s, e) => s + e.amount, 0);
    const entry = byService.get(key) ?? {
      serviceId: job.serviceId,
      name: job.service?.name ?? (locale === 'fr' ? 'Sans service' : 'No service'),
      jobs: 0,
      revenue: 0,
      costs: 0,
      margin: 0,
      marginPct: null as number | null,
    };
    entry.jobs += 1;
    entry.revenue += job.price ?? 0;
    entry.costs += costs;
    byService.set(key, entry);
  }
  const serviceMargins = [...byService.values()]
    .map((s) => ({
      ...s,
      margin: s.revenue - s.costs,
      marginPct: s.revenue > 0 ? Math.round(((s.revenue - s.costs) / s.revenue) * 1000) / 10 : null,
    }))
    .sort((a, b) => b.margin - a.margin);

  // --- Customer lifetime value (collected revenue per customer, from paid jobs) ---
  const revenueByCustomer = new Map<string, { revenue: number; jobs: number }>();
  for (const job of jobs) {
    if (!COMPLETED.includes(job.status)) continue;
    const entry = revenueByCustomer.get(job.customerId) ?? { revenue: 0, jobs: 0 };
    entry.revenue += job.price ?? 0;
    entry.jobs += 1;
    revenueByCustomer.set(job.customerId, entry);
  }
  const payingCustomers = revenueByCustomer.size;
  const customerLifetimeValue =
    payingCustomers > 0
      ? {
          avgValue:
            [...revenueByCustomer.values()].reduce((s, c) => s + c.revenue, 0) / payingCustomers,
          repeatRatePct:
            Math.round(
              ([...revenueByCustomer.values()].filter((c) => c.jobs >= 2).length / payingCustomers) * 1000
            ) / 10,
          payingCustomers,
        }
      : null;

  // --- Seasonal demand: jobs per calendar month across all years ---
  const monthJobs = new Array<number>(12).fill(0);
  const monthYears = new Map<number, Set<number>>();
  for (const job of jobs) {
    const m = job.date.getMonth();
    monthJobs[m] += 1;
    if (!monthYears.has(m)) monthYears.set(m, new Set());
    monthYears.get(m)!.add(job.date.getFullYear());
  }
  const monthNames = Array.from({ length: 12 }, (_, m) =>
    new Date(2026, m, 1).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short' })
  );
  const seasonalDemand = monthNames.map((month, m) => ({
    month,
    jobs: monthYears.get(m)?.size
      ? Math.round((monthJobs[m] / monthYears.get(m)!.size) * 10) / 10
      : 0,
  }));

  // --- Weekday demand & value (completed history) → smart scheduling suggestions ---
  const jobsByWeekday = new Array<number>(7).fill(0);
  const valueByWeekday = new Array<number>(7).fill(0);
  for (const job of jobs) {
    if (!COMPLETED.includes(job.status)) continue;
    const w = job.date.getDay();
    jobsByWeekday[w] += 1;
    valueByWeekday[w] += job.price ?? 0;
  }
  const busiestWeekday =
    jobsByWeekday.some((n) => n > 0)
      ? jobsByWeekday.indexOf(Math.max(...jobsByWeekday))
      : null;
  const avgValueByWeekday = jobsByWeekday.map((n, i) =>
    n > 0 ? Math.round((valueByWeekday[i] / n) * 100) / 100 : null
  );

  // --- Quote follow-ups: SENT quotes waiting 7+ days ---
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const staleQuotes = quotes
    .filter((q) => q.status === 'SENT' && q.createdAt < weekAgo)
    .map((q) => ({
      id: q.id,
      number: q.number,
      customerName: q.customer.name,
      total: q.total,
      daysWaiting: Math.floor((now.getTime() - q.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
    }));
  const decidedQuotes = quotes.filter((q) => ['APPROVED', 'DECLINED'].includes(q.status));
  const quoteWinRatePct =
    decidedQuotes.length > 0
      ? Math.round(
          (decidedQuotes.filter((q) => q.status === 'APPROVED').length / decidedQuotes.length) * 1000
        ) / 10
      : null;

  // --- Technician utilization (completed/paid jobs) ---
  const byTech = new Map<string, { jobs: number; revenue: number }>();
  for (const job of jobs) {
    if (!COMPLETED.includes(job.status)) continue;
    const name = job.assignedTo?.name?.trim() || job.technician?.trim();
    if (!name) continue;
    const entry = byTech.get(name) ?? { jobs: 0, revenue: 0 };
    entry.jobs += 1;
    entry.revenue += job.price ?? 0;
    byTech.set(name, entry);
  }
  const technicians = [...byTech.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.jobs - a.jobs);

  return {
    revenueTrend,
    revenueMomentumPct,
    serviceMargins,
    customerLifetimeValue,
    seasonalDemand,
    busiestWeekday,
    avgValueByWeekday,
    staleQuotes,
    quoteWinRatePct,
    technicians,
    basisJobs: jobs.length,
    basisPayments: payments.length,
    basisQuotes: quotes.length,
  };
}

