/**
 * What-if scenarios — simple projections from the last 90 days of real data.
 * Every number is labeled an estimate in the UI; this module just does the
 * arithmetic. Pure and tested.
 */
import { prisma } from '@/lib/prisma';

export interface ScenarioInput {
  /** Paid invoice totals, trailing 90 days. */
  revenue90d: number;
  /** Completed jobs, trailing 90 days. */
  jobs90d: number;
  /** People on the team (proxy for technician capacity). */
  teamSize: number;
}

export interface ScenarioOutput {
  monthlyRevenue: number;
  avgJobValue: number;
  jobsPerMonth: number;
  revenueDrop: { projected: number; shortfall: number };
  priceRise: { extraPerJob: number; monthlyUpside: number };
  hireTech: {
    jobsPerTechPerMonth: number | null;
    extraCapacityJobs: number | null;
    revenuePotential: number | null;
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeScenarios(input: ScenarioInput): ScenarioOutput {
  const monthlyRevenue = round2(input.revenue90d / 3);
  const jobsPerMonth = round2(input.jobs90d / 3);
  const avgJobValue = input.jobs90d > 0 ? round2(input.revenue90d / input.jobs90d) : 0;

  const jobsPerTechPerMonth =
    input.teamSize > 0 && input.jobs90d > 0
      ? round2(input.jobs90d / 3 / input.teamSize)
      : null;

  return {
    monthlyRevenue,
    avgJobValue,
    jobsPerMonth,
    revenueDrop: {
      projected: round2(monthlyRevenue * 0.9),
      shortfall: round2(monthlyRevenue * 0.1),
    },
    priceRise: {
      extraPerJob: round2(avgJobValue * 0.05),
      monthlyUpside: round2(jobsPerMonth * avgJobValue * 0.05),
    },
    hireTech: {
      jobsPerTechPerMonth,
      extraCapacityJobs: jobsPerTechPerMonth,
      revenuePotential:
        jobsPerTechPerMonth != null ? round2(jobsPerTechPerMonth * avgJobValue) : null,
    },
  };
}

export async function getScenarioData(businessId: string): Promise<ScenarioInput> {
  const d90 = new Date(Date.now() - 90 * 86_400_000);
  const [paid, jobs, team] = await Promise.all([
    prisma.invoice.findMany({
      where: { businessId, status: 'PAID', paidAt: { gte: d90 } },
      select: { total: true },
      take: 1000,
    }),
    prisma.job.count({
      where: { businessId, status: { in: ['COMPLETED', 'PAID'] }, date: { gte: d90 } },
    }),
    prisma.user.count({ where: { businessId } }),
  ]);
  return {
    revenue90d: paid.reduce((s, i) => s + i.total, 0),
    jobs90d: jobs,
    teamSize: team,
  };
}
