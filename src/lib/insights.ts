/**
 * AI Business Insights - computed strictly from the business's own records.
 *
 * Every figure below is derived from real jobs, payments, quotes, customers
 * and expenses in the tenant's database. No benchmarks, no fake averages,
 * no fabricated data. Each insight carries a `basis` string naming the
 * records it was computed from, and the UI labels the whole page as
 * "computed from your own data".
 */

import { prisma } from './prisma';
import { centsToDollars } from './money.ts';
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

  const [paymentsRaw, jobsRaw, quotesRaw] = await Promise.all([
    prisma.payment.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: rangeStart }, businessId },
      select: { amountCents: true, createdAt: true },
    }),
    prisma.job.findMany({
      where: { businessId },
      select: {
        priceCents: true,
        status: true,
        date: true,
        customerId: true,
        technician: true,
        assignedTo: { select: { name: true } },
        serviceId: true,
        service: { select: { name: true } },
        expenses: { select: { amountCents: true } },
      },
    }),
    prisma.quote.findMany({
      where: { businessId },
      select: {
        id: true,
        number: true,
        totalCents: true,
        status: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // computeInsights works in dollars; convert BigInt cents at the boundary.
  const payments: InsightPayment[] = paymentsRaw.map((p) => ({
    amount: centsToDollars(p.amountCents),
    createdAt: p.createdAt,
  }));
  const jobs: InsightJob[] = jobsRaw.map((j) => ({
    price: centsToDollars(j.priceCents),
    status: j.status,
    date: j.date,
    customerId: j.customerId,
    technician: j.technician,
    assignedTo: j.assignedTo,
    serviceId: j.serviceId,
    service: j.service,
    expenses: j.expenses.map((e) => ({ amount: centsToDollars(e.amountCents) })),
  }));
  const quotes: InsightQuote[] = quotesRaw.map((q) => ({
    id: q.id,
    number: q.number,
    total: centsToDollars(q.totalCents),
    status: q.status,
    createdAt: q.createdAt,
    customer: q.customer,
  }));

  return computeInsights(payments, jobs, quotes, locale, now);
}
