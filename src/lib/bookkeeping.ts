/**
 * Bookkeeping - profit & loss from real operational data.
 *
 * No separate "books" to maintain: revenue comes from COMPLETED payments,
 * costs from JobExpense records. This module merges them into the P&L view
 * owners actually need, grouped by month and category.
 */
import { prisma } from '@/lib/prisma';

export interface MonthlyPL {
  monthKey: string; // YYYY-MM
  label: string; // "Oct 2026" in the viewer's locale
  revenue: number;
  expenses: number;
  profit: number;
}

export interface CategoryTotal {
  category: string;
  total: number;
  count: number;
}

export interface BookkeepingData {
  months: MonthlyPL[];
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  marginPct: number | null;
  byCategory: CategoryTotal[];
  receivables: number; // unpaid invoice balances
  jobCount: number;
}

function monthKeyInTz(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).format(d);
  return parts.slice(0, 7); // YYYY-MM
}

export async function getBookkeeping(
  businessId: string,
  monthsBack = 6,
  locale: 'en' | 'fr' = 'en'
): Promise<BookkeepingData> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  });
  const timezone = business?.timezone || 'America/Toronto';
  const now = new Date();

  // Anchor: first day of the current month, monthsBack months ago.
  const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  anchor.setUTCMonth(anchor.getUTCMonth() - (monthsBack - 1));
  const start = anchor;

  const [payments, expenses, invoices] = await Promise.all([
    prisma.payment.findMany({
      where: { businessId, status: 'COMPLETED', createdAt: { gte: start } },
      select: { amount: true, createdAt: true },
      take: 5000,
    }),
    prisma.jobExpense.findMany({
      where: { businessId, spentAt: { gte: start } },
      select: { amount: true, spentAt: true, category: true },
      take: 5000,
    }),
    prisma.invoice.findMany({
      where: { businessId, status: { in: ['UNPAID', 'PARTIALLY_PAID', 'PARTIALLY PAID'] } },
      select: {
        total: true,
        payments: { where: { status: 'COMPLETED' }, select: { amount: true } },
      },
      take: 2000,
    }),
  ]);

  const monthLabels = new Map<string, string>();
  const fmt = (key: string) => {
    if (!monthLabels.has(key)) {
      const [y, m] = key.split('-').map(Number);
      monthLabels.set(
        key,
        new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(Date.UTC(y, m - 1, 1)))
      );
    }
    return monthLabels.get(key)!;
  };

  const byMonth = new Map<string, { revenue: number; expenses: number }>();
  // Seed all months in range so empty months still render.
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    byMonth.set(key, { revenue: 0, expenses: 0 });
  }

  for (const p of payments) {
    const key = monthKeyInTz(p.createdAt, timezone);
    const slot = byMonth.get(key);
    if (slot) slot.revenue += p.amount;
  }
  for (const e of expenses) {
    const key = monthKeyInTz(e.spentAt, timezone);
    const slot = byMonth.get(key);
    if (slot) slot.expenses += e.amount;
  }

  const months: MonthlyPL[] = [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([monthKey, v]) => ({
      monthKey,
      label: fmt(monthKey),
      revenue: v.revenue,
      expenses: v.expenses,
      profit: v.revenue - v.expenses,
    }));

  const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expenses, 0);
  const totalProfit = totalRevenue - totalExpenses;

  const catMap = new Map<string, { total: number; count: number }>();
  for (const e of expenses) {
    const c = e.category || 'OTHER';
    const slot = catMap.get(c) ?? { total: 0, count: 0 };
    slot.total += e.amount;
    slot.count += 1;
    catMap.set(c, slot);
  }
  const byCategory: CategoryTotal[] = [...catMap.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.total - a.total);

  const receivables = invoices.reduce((s, inv) => {
    const paid = inv.payments.reduce((ss, p) => ss + p.amount, 0);
    return s + Math.max(0, inv.total - paid);
  }, 0);

  return {
    months,
    totalRevenue,
    totalExpenses,
    totalProfit,
    marginPct: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : null,
    byCategory,
    receivables,
    jobCount: 0,
  };
}
