/**
 * AI Business Insights — computed strictly from the business's own records.
 *
 * Every figure below is derived from real jobs, payments, quotes, customers
 * and expenses in the tenant's database. No benchmarks, no fake averages,
 * no fabricated data. Each insight carries a `basis` string naming the
 * records it was computed from, and the UI labels the whole page as
 * "computed from your own data".
 */

import { prisma } from './prisma';
import {
  computeInsights,
  type InsightPayment,
  type InsightJob,
  type InsightQuote,
  type Insights,
} from './insights-compute';

// Re-exported so existing importers keep working.
export { computeInsights };
export type { InsightPayment, InsightJob, InsightQuote };
export type { Insights, RevenueTrendPoint, ServiceMargin } from './insights-compute';

const COMPLETED = ['COMPLETED', 'PAID'];

function monthLabel(d: Date, locale: 'en' | 'fr'): string {
  return d.toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short' });
}

/** DB-backed entry point: fetches the tenant's own rows, then delegates to the pure computation. */
export async function getInsights(businessId: string, locale: 'en' | 'fr' = 'en'): Promise<Insights> {
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);

  const [payments, jobs, quotes] = await Promise.all([
    prisma.payment.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: rangeStart }, invoice: { businessId } },
      select: { amount: true, createdAt: true },
    }),
    prisma.job.findMany({
      where: { businessId },
      select: {
        price: true,
        status: true,
        date: true,
        customerId: true,
        technician: true,
        assignedTo: { select: { name: true } },
        serviceId: true,
        service: { select: { name: true } },
        expenses: { select: { amount: true } },
      },
    }),
    prisma.quote.findMany({
      where: { businessId },
      select: {
        id: true,
        number: true,
        total: true,
        status: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return computeInsights(payments, jobs, quotes, locale, now);
}
