/**
 * F9: Reports — server-side data fetching.
 *
 * Server-only (imports prisma). Every query scopes by businessId FIRST;
 * voided invoices/payments are excluded from all revenue/AR/tax numbers.
 * Returns plain serializable data (BigInt converted to Number cents) for
 * the pure functions in ./reports-f9.ts.
 */
import { prisma } from './prisma.ts';
import {
  computeRevenueByMonth,
  computeAging,
  computeTaxByType,
  computeJobProfit,
  computeExpensesByCategory,
  computeLeadSources,
  type RevenueMonth,
  type AgingSummary,
  type TaxPeriodRow,
  type JobProfit,
  type ExpenseCategoryRow,
  type LeadSourceRow,
} from './reports-f9.ts';

const toCents = (v: bigint | number | null | undefined): number =>
  v === null || v === undefined ? 0 : Number(v);

export interface F9Data {
  year: number;
  revenue: RevenueMonth[];
  aging: AgingSummary;
  tax: { rows: TaxPeriodRow[]; types: string[]; totals: Record<string, number> };
  profit: JobProfit[];
  expenses: ExpenseCategoryRow[];
  leads: { rows: LeadSourceRow[]; total: number; converted: number; conversionPct: number };
  totals: {
    invoicedCents: number;
    collectedCents: number;
    outstandingCents: number;
    expenseCents: number;
  };
}

/**
 * Fetch and compute every F9 report for one business + year.
 * All aggregates filter by businessId; voided rows are excluded.
 */
export async function fetchF9Data(
  businessId: string,
  year: number,
  tz: string,
  locale: 'en' | 'fr',
): Promise<F9Data> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));

  // --- Invoices (non-voided) with their completed, non-voided payments.
  const invoices = await prisma.invoice.findMany({
    where: {
      businessId,
      voidedAt: null,
      date: { gte: yearStart, lt: nextYearStart },
    },
    select: {
      id: true,
      date: true,
      totalCents: true,
      status: true,
      dueAt: true,
      payments: {
        where: { status: 'COMPLETED', voidedAt: null },
        select: { amountCents: true },
      },
    },
  });

  // --- Payments (completed, non-voided) in the year — the "collected" side.
  const payments = await prisma.payment.findMany({
    where: {
      businessId,
      status: 'COMPLETED',
      voidedAt: null,
      createdAt: { gte: yearStart, lt: nextYearStart },
    },
    select: { amountCents: true, createdAt: true },
  });

  // --- AR aging needs ALL unpaid invoices, not just this year's.
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      businessId,
      voidedAt: null,
      status: { in: ['UNPAID', 'PARTIALLY PAID'] },
    },
    select: {
      id: true,
      date: true,
      totalCents: true,
      dueAt: true,
      payments: {
        where: { status: 'COMPLETED', voidedAt: null },
        select: { amountCents: true },
      },
    },
  });

  // --- Tax lines for non-voided invoices in the year.
  const taxLines = await prisma.invoiceTaxLine.findMany({
    where: {
      invoice: { businessId, voidedAt: null, date: { gte: yearStart, lt: nextYearStart } },
    },
    select: {
      taxType: true,
      amountCents: true,
      invoice: { select: { date: true } },
    },
  });

  // --- Job profitability: jobs in the year with linked invoices + expenses.
  const jobs = await prisma.job.findMany({
    where: {
      businessId,
      date: { gte: yearStart, lt: nextYearStart },
      status: { not: 'CANCELLED' },
    },
    select: {
      id: true,
      title: true,
      invoices: {
        where: { voidedAt: null },
        select: { totalCents: true },
      },
      expenses: { select: { amountCents: true } },
    },
    take: 200,
  });

  // --- Expenses by category in the year (general + job-linked).
  const expenses = await prisma.jobExpense.findMany({
    where: {
      businessId,
      spentAt: { gte: yearStart, lt: nextYearStart },
    },
    select: {
      category: true,
      amountCents: true,
      taxGstHstCents: true,
      taxQstCents: true,
      taxPstCents: true,
    },
  });

  // --- Leads (all time — sources and conversion are cumulative).
  const leads = await prisma.lead.findMany({
    where: { businessId },
    select: { source: true, status: true },
  });

  const now = new Date();

  const revenue = computeRevenueByMonth(
    invoices.map((i) => ({ totalCents: toCents(i.totalCents), date: i.date })),
    payments.map((p) => ({ amountCents: toCents(p.amountCents), createdAt: p.createdAt })),
    year,
    tz,
    locale,
  );

  const aging = computeAging(
    unpaidInvoices.map((i) => ({
      id: i.id,
      totalCents: toCents(i.totalCents),
      paidCents: i.payments.reduce((s, p) => s + toCents(p.amountCents), 0),
      dueAt: i.dueAt,
      date: i.date,
    })),
    now,
  );

  const tax = computeTaxByType(
    taxLines.map((t) => ({
      taxType: t.taxType,
      amountCents: toCents(t.amountCents),
      invoiceDate: t.invoice.date,
    })),
    year,
    tz,
    locale,
  );

  const profit = computeJobProfit(
    jobs.map((j) => ({
      id: j.id,
      title: j.title,
      revenueCents: j.invoices.reduce((s, inv) => s + toCents(inv.totalCents), 0),
      costCents: j.expenses.reduce((s, e) => s + toCents(e.amountCents), 0),
    })),
  );

  const expenseRows = computeExpensesByCategory(
    expenses.map((e) => ({
      category: e.category,
      amountCents: toCents(e.amountCents),
      taxGstHstCents: toCents(e.taxGstHstCents),
      taxQstCents: toCents(e.taxQstCents),
      taxPstCents: toCents(e.taxPstCents),
    })),
  );

  const leadSummary = computeLeadSources(leads);

  return {
    year,
    revenue,
    aging,
    tax,
    profit,
    expenses: expenseRows,
    leads: leadSummary,
    totals: {
      invoicedCents: revenue.reduce((s, m) => s + m.invoicedCents, 0),
      collectedCents: revenue.reduce((s, m) => s + m.collectedCents, 0),
      outstandingCents: aging.totalOutstandingCents,
      expenseCents: expenseRows.reduce((s, r) => s + r.amountCents, 0),
    },
  };
}
