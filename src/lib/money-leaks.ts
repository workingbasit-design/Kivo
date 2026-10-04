/**
 * Money leaks — "where are you losing money?", measured from real data.
 *
 * Two kinds of numbers:
 * - measured: sums of actual records (overdue balances, unbilled work).
 * - estimated: pipeline value at risk (idle quotes), clearly labeled.
 */
import { prisma } from '@/lib/prisma';
import { daysOverdue, needsFollowUp, daysWaiting, remainingBalance } from './revenue.ts';

export type LeakKind = 'overdue' | 'unbilled' | 'idleQuotes';

export interface MoneyLeak {
  id: LeakKind;
  titleKey: string;
  detailKey: string;
  detailParams: Record<string, string | number>;
  /** CAD at risk. */
  amount: number;
  count: number;
  href: string;
  /** false for pipeline estimates — the UI must label them as such. */
  measured: boolean;
}

export interface MoneyLeakInput {
  now: Date;
  timezone?: string | null;
  overdueInvoices: { balance: number; daysOverdue: number }[];
  unbilledJobs: { price: number }[];
  idleQuotes: { total: number; daysWaiting: number }[];
}

export function computeMoneyLeaks(input: MoneyLeakInput): MoneyLeak[] {
  const leaks: MoneyLeak[] = [];

  const overdueTotal = input.overdueInvoices.reduce((s, i) => s + i.balance, 0);
  if (input.overdueInvoices.length > 0) {
    const maxDays = Math.max(...input.overdueInvoices.map((i) => i.daysOverdue));
    leaks.push({
      id: 'overdue',
      titleKey: 'leaks.overdue.title',
      detailKey: 'leaks.overdue.detail',
      detailParams: { count: input.overdueInvoices.length, days: maxDays },
      amount: Math.round(overdueTotal * 100) / 100,
      count: input.overdueInvoices.length,
      href: '/invoices?status=UNPAID',
      measured: true,
    });
  }

  const unbilledTotal = input.unbilledJobs.reduce((s, j) => s + j.price, 0);
  if (input.unbilledJobs.length > 0) {
    leaks.push({
      id: 'unbilled',
      titleKey: 'leaks.unbilled.title',
      detailKey: 'leaks.unbilled.detail',
      detailParams: { count: input.unbilledJobs.length },
      amount: Math.round(unbilledTotal * 100) / 100,
      count: input.unbilledJobs.length,
      href: '/jobs?status=COMPLETED',
      measured: true,
    });
  }

  const idleTotal = input.idleQuotes.reduce((s, q) => s + q.total, 0);
  if (input.idleQuotes.length > 0) {
    const maxDays = Math.max(...input.idleQuotes.map((q) => q.daysWaiting));
    leaks.push({
      id: 'idleQuotes',
      titleKey: 'leaks.idleQuotes.title',
      detailKey: 'leaks.idleQuotes.detail',
      detailParams: {
        count: input.idleQuotes.length,
        days: maxDays,
        amount: idleTotal.toFixed(2),
      },
      amount: Math.round(idleTotal * 100) / 100,
      count: input.idleQuotes.length,
      href: '/quotes?status=SENT',
      measured: false,
    });
  }

  return leaks.sort((a, b) => b.amount - a.amount);
}

export async function getMoneyLeaks(businessId: string): Promise<MoneyLeak[]> {
  const now = new Date();
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  });
  const timezone = business?.timezone ?? null;

  const [invoices, jobs, invoicedJobIds, quotes] = await Promise.all([
    prisma.invoice.findMany({
      where: { businessId, status: { in: ['UNPAID', 'PARTIALLY PAID'] } },
      select: {
        date: true,
        total: true,
        payments: { where: { status: 'COMPLETED' }, select: { amount: true } },
      },
      take: 200,
    }),
    prisma.job.findMany({
      where: { businessId, status: 'COMPLETED' },
      select: { id: true, price: true },
      take: 200,
    }),
    prisma.invoice.findMany({
      where: { businessId, jobId: { not: null } },
      select: { jobId: true },
    }),
    prisma.quote.findMany({
      where: { businessId, status: 'SENT' },
      select: { total: true, updatedAt: true },
      take: 200,
    }),
  ]);

  const invoiced = new Set(
    invoicedJobIds.map((i) => i.jobId).filter((v): v is string => !!v)
  );

  return computeMoneyLeaks({
    now,
    timezone,
    overdueInvoices: invoices
      .map((inv) => ({
        balance: remainingBalance(
          inv.total,
          inv.payments.map((p) => p.amount)
        ),
        daysOverdue: daysOverdue(inv.date, now, timezone),
      }))
      .filter((i) => i.balance > 0 && i.daysOverdue > 0),
    unbilledJobs: jobs
      .filter((j) => !invoiced.has(j.id) && j.price > 0)
      .map((j) => ({ price: j.price })),
    idleQuotes: quotes
      .filter((q) => needsFollowUp(q.updatedAt, now))
      .map((q) => ({ total: q.total, daysWaiting: daysWaiting(q.updatedAt, now) })),
  });
}

/** Sum of measured (non-estimate) leak amounts. */
export function measuredLeakTotal(leaks: MoneyLeak[]): number {
  return leaks.filter((l) => l.measured).reduce((s, l) => s + l.amount, 0);
}
