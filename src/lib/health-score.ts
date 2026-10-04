/**
 * Business health score — 0-100 with explainable subscores.
 *
 * Every subscore states its inputs; the UI renders the explanation next to
 * the number. A subscore with no data is omitted (not zeroed) so a new
 * business isn't punished for being new.
 */
import { prisma } from '@/lib/prisma';
import { daysOverdue, remainingBalance } from './revenue.ts';

export type HealthSubKey = 'cashFlow' | 'pipeline' | 'operations' | 'profitability';

export interface HealthSubscore {
  key: HealthSubKey;
  /** 0-100, or null when there isn't enough data. */
  score: number | null;
  titleKey: string;
  explainKey: string;
  explainParams: Record<string, string | number>;
}

export interface HealthScore {
  /** Weighted average of available subscores, 0-100. Null when nothing to score. */
  total: number | null;
  subs: HealthSubscore[];
}

export interface HealthInput {
  /** All open receivables. */
  receivables: { total: number; overdueBalance: number }[];
  /** Leads created in the last 14 days. */
  newLeads14d: number;
  /** Currently open quotes (SENT). */
  openQuotes: number;
  /** Jobs scheduled in the last 60 days: completed vs total. */
  jobsCompleted60d: number;
  jobsScheduled60d: number;
  /** Last 90 days: paid revenue and recorded job expenses. */
  revenue90d: number;
  expenses90d: number;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function computeHealthScore(input: HealthInput): HealthScore {
  const subs: HealthSubscore[] = [];

  // Cash flow: share of receivables that is overdue. No receivables = 100.
  const totalAR = input.receivables.reduce((s, r) => s + r.total, 0);
  const overdueAR = input.receivables.reduce((s, r) => s + r.overdueBalance, 0);
  if (totalAR > 0) {
    const overduePct = (overdueAR / totalAR) * 100;
    subs.push({
      key: 'cashFlow',
      score: clamp(100 - overduePct * 2),
      titleKey: 'health.cashFlow',
      explainKey: 'health.cashFlowExplain',
      explainParams: { overduePct: Math.round(overduePct) },
    });
  } else {
    subs.push({
      key: 'cashFlow',
      score: 100,
      titleKey: 'health.cashFlow',
      explainKey: 'health.cashFlowExplain',
      explainParams: { overduePct: 0 },
    });
  }

  // Pipeline: recent demand. 12 pts per new lead, 8 per open quote, capped.
  const pipelineRaw = input.newLeads14d * 12 + input.openQuotes * 8;
  subs.push({
    key: 'pipeline',
    score: clamp(pipelineRaw),
    titleKey: 'health.pipeline',
    explainKey: 'health.pipelineExplain',
    explainParams: { leads: input.newLeads14d, quotes: input.openQuotes },
  });

  // Operations: completion rate of scheduled work (60 days).
  if (input.jobsScheduled60d > 0) {
    const onTime = (input.jobsCompleted60d / input.jobsScheduled60d) * 100;
    subs.push({
      key: 'operations',
      score: clamp(onTime),
      titleKey: 'health.operations',
      explainKey: 'health.operationsExplain',
      explainParams: { onTime: Math.round(Math.min(100, onTime)) },
    });
  } else {
    subs.push({
      key: 'operations',
      score: null,
      titleKey: 'health.operations',
      explainKey: 'health.noData',
      explainParams: {},
    });
  }

  // Profitability: margin on paid revenue vs recorded expenses (90 days).
  // Honest about its limits: labor without recorded cost isn't in here.
  if (input.revenue90d > 0) {
    const margin = ((input.revenue90d - input.expenses90d) / input.revenue90d) * 100;
    subs.push({
      key: 'profitability',
      score: clamp(margin),
      titleKey: 'health.profitability',
      explainKey: 'health.profitabilityExplain',
      explainParams: { margin: Math.round(margin) },
    });
  } else {
    subs.push({
      key: 'profitability',
      score: null,
      titleKey: 'health.profitability',
      explainKey: 'health.noData',
      explainParams: {},
    });
  }

  const scored = subs.filter((s) => s.score !== null);
  const total =
    scored.length > 0
      ? Math.round(scored.reduce((s, x) => s + (x.score as number), 0) / scored.length)
      : null;
  return { total, subs };
}

export async function getHealthScore(businessId: string): Promise<HealthScore> {
  const now = new Date();
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  });
  const timezone = business?.timezone ?? null;
  const d14 = new Date(now.getTime() - 14 * 86_400_000);
  const d60 = new Date(now.getTime() - 60 * 86_400_000);
  const d90 = new Date(now.getTime() - 90 * 86_400_000);

  const [invoices, newLeads, openQuotes, jobs60, paidInvoices90, expenses90] =
    await Promise.all([
      prisma.invoice.findMany({
        where: { businessId, status: { in: ['UNPAID', 'PARTIALLY PAID'] } },
        select: {
          date: true,
          total: true,
          payments: { where: { status: 'COMPLETED' }, select: { amount: true } },
        },
        take: 500,
      }),
      prisma.lead.count({ where: { businessId, createdAt: { gte: d14 } } }),
      prisma.quote.count({ where: { businessId, status: 'SENT' } }),
      prisma.job.groupBy({
        by: ['status'],
        where: { businessId, date: { gte: d60 } },
        _count: { status: true },
      }),
      prisma.invoice.findMany({
        where: { businessId, status: 'PAID', paidAt: { gte: d90 } },
        select: { total: true },
        take: 500,
      }),
      prisma.jobExpense.aggregate({
        where: { businessId, spentAt: { gte: d90 } },
        _sum: { amount: true },
      }),
    ]);

  const scheduled = jobs60.reduce((s, g) => s + g._count.status, 0);
  const completed = jobs60
    .filter((g) => g.status === 'COMPLETED' || g.status === 'PAID')
    .reduce((s, g) => s + g._count.status, 0);

  return computeHealthScore({
    receivables: invoices.map((inv) => ({
      total: inv.total,
      overdueBalance:
        daysOverdue(inv.date, now, timezone) > 0
          ? remainingBalance(
              inv.total,
              inv.payments.map((p) => p.amount)
            )
          : 0,
    })),
    newLeads14d: newLeads,
    openQuotes,
    jobsCompleted60d: completed,
    jobsScheduled60d: scheduled,
    revenue90d: paidInvoices90.reduce((s, i) => s + i.total, 0),
    expenses90d: expenses90._sum.amount ?? 0,
  });
}
