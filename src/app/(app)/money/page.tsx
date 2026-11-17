import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { canSeePrices } from '@/lib/roles';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getTaxConfig } from '@/lib/tax';
import {
  buildMoneyActivity,
  remainingCents,
  type MoneyActivityItem,
} from '@/lib/money-hub';
import MoneyClient, { type UnpaidInvoiceOption } from './MoneyClient';
import type { ExportColumn } from '@/components/ExportButtons';

/**
 * Money hub redesign (ChatGPT Money prototype, 2026-11-17): overview
 * metrics (Outstanding, Income received, Expenses, Net cash flow),
 * payment activity with All / Income / Expenses / Invoices filters and
 * CSV export, quick actions, and the entry modal for recording a payment
 * or adding an expense (New invoice reuses the real NewInvoiceModal).
 *
 * All figures come from the real shared records — no parallel money
 * store, no sample data. Stats are database aggregates over the whole
 * tables (exact at any scale); the activity feed is the latest 200 rows
 * per source, merged newest-first.
 *
 * Deliberate deviations from the prototype:
 * - The old hub sections (Ready to invoice, Awaiting payment, Awaiting
 *   a decision) are replaced by the prototype layout: outstanding is
 *   now the Outstanding metric and invoice creation is an activity row.
 * - The prototype's invoice modal (title + amount) is NOT ported: a
 *   real invoice needs a customer, line items and tax, so New invoice
 *   opens the existing NewInvoiceModal wrapping the real InvoiceForm.
 * - The prototype's payment modal has a free-form description and a
 *   date; a real Payment must attach to an invoice and recordPayment
 *   stamps today, so the modal picks an unpaid invoice instead and
 *   records with today's date.
 * - The prototype's expense modal has a vendor field; JobExpense has
 *   none, so the vendor is stored in the expense note.
 * - The prototype joins detail and date with a middle dot; the
 *   copy-lint bans it, so activity rows use a comma.
 */
const ACTIVITY_TAKE = 200;

/** Human labels for payment providers (record-only). */
function providerLabel(p: string, locale: Locale): string {
  if (p === 'CASH') return t(locale, 't10money.money.providerCash');
  if (p === 'CHEQUE') return t(locale, 't10money.money.providerCheque');
  if (p === 'OTHER') return t(locale, 't10money.money.providerOther');
  if (p === 'STRIPE') return t(locale, 't10money.money.providerCard');
  return t(locale, 't10money.money.providerInterac');
}

export default async function MoneyPage() {
  const { businessId, role } = await requireAuth();

  // SEE_PRICES gate: every figure on this page is money data. Viewers
  // without the capability (technicians) are bounced to their dashboard
  // before any query runs, so no amounts reach the response.
  if (!canSeePrices(role)) {
    redirect('/dashboard');
  }

  const locale = await getLocale();

  const [
    business,
    payments,
    expenses,
    invoices,
    unpaidTotals,
    outstandingPaid,
    incomeAgg,
    expenseAgg,
    modalCustomers,
  ] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: {
        currency: true,
        regionCode: true,
        taxRegion: true,
        gstHstRegistered: true,
      },
    }),
    // Income rows: COMPLETED payments on live invoices, newest first.
    prisma.payment.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        invoice: { businessId, voidedAt: null },
      },
      select: {
        id: true,
        amountCents: true,
        provider: true,
        createdAt: true,
        invoiceId: true,
        invoice: {
          select: { number: true, customer: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: ACTIVITY_TAKE,
    }),
    // Expense rows: every JobExpense, newest spending first.
    prisma.jobExpense.findMany({
      where: { businessId },
      select: {
        id: true,
        description: true,
        amountCents: true,
        category: true,
        spentAt: true,
        note: true,
        createdAt: true,
      },
      orderBy: { spentAt: 'desc' },
      take: ACTIVITY_TAKE,
    }),
    // Invoice rows (activity + payment picker): live invoices with the
    // payments that decide their remaining balance.
    prisma.invoice.findMany({
      where: { businessId, voidedAt: null },
      select: {
        id: true,
        number: true,
        totalCents: true,
        status: true,
        createdAt: true,
        customer: { select: { name: true } },
        payments: { select: { amountCents: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: ACTIVITY_TAKE,
    }),
    // Outstanding = live unpaid invoice totals minus the money already
    // taken against them (same arithmetic as /invoices).
    prisma.invoice.aggregate({
      where: { businessId, voidedAt: null, status: { not: 'PAID' } },
      _sum: { totalCents: true },
    }),
    prisma.payment.aggregate({
      where: {
        businessId,
        status: 'COMPLETED',
        invoice: { businessId, voidedAt: null, status: { not: 'PAID' } },
      },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({
      where: {
        businessId,
        status: 'COMPLETED',
        invoice: { businessId, voidedAt: null },
      },
      _sum: { amountCents: true },
    }),
    prisma.jobExpense.aggregate({
      where: { businessId },
      _sum: { amountCents: true },
    }),
    // The New Invoice modal wraps the real InvoiceForm, so the money
    // page supplies its customers like /invoices/new.
    prisma.customer.findMany({
      where: { businessId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const outstandingCents =
    Number(unpaidTotals._sum.totalCents ?? BigInt(0)) -
    Number(outstandingPaid._sum.amountCents ?? BigInt(0));
  const incomeCents = Number(incomeAgg._sum.amountCents ?? BigInt(0));
  const expensesCents = Number(expenseAgg._sum.amountCents ?? BigInt(0));

  const categoryLabel = (category: string) =>
    t(locale, `expenses.categories.${category}`);

  const activity: MoneyActivityItem[] = buildMoneyActivity([
    ...payments.map((p) => ({
      id: p.id,
      kind: 'income' as const,
      title: `${p.invoice.number}, ${p.invoice.customer.name}`,
      detail: providerLabel(p.provider, locale),
      date: p.createdAt.toISOString(),
      amountCents: Number(p.amountCents),
      party: p.invoice.customer.name,
      href: `/invoices/${p.invoiceId}`,
      sortMs: p.createdAt.getTime(),
    })),
    ...expenses.map((e) => ({
      id: e.id,
      kind: 'expense' as const,
      title: e.description,
      detail: categoryLabel(e.category),
      date: e.spentAt.toISOString(),
      amountCents: -Number(e.amountCents),
      party: e.note ?? '',
      href: '/expenses',
      sortMs: e.createdAt.getTime(),
    })),
    ...invoices.map((inv) => ({
      id: `inv-${inv.id}`,
      kind: 'invoice' as const,
      title: `${inv.number}, ${inv.customer.name}`,
      detail: t(locale, 't10money.money.invoiceCreatedDetail'),
      date: inv.createdAt.toISOString(),
      amountCents: Number(inv.totalCents),
      party: inv.customer.name,
      href: `/invoices/${inv.id}`,
      sortMs: inv.createdAt.getTime(),
    })),
  ]);

  // Payment picker: live unpaid invoices with a real remaining balance.
  const unpaidInvoices: UnpaidInvoiceOption[] = invoices
    .filter((inv) => inv.status !== 'PAID')
    .map((inv) => ({
      id: inv.id,
      number: inv.number,
      customerName: inv.customer.name,
      remainingCents: Number(
        remainingCents(inv.totalCents, inv.payments)
      ),
    }))
    .filter((inv) => inv.remainingCents > 0);

  const exportColumns: ExportColumn[] = [
    { key: 'type', label: t(locale, 'exports.colType') },
    { key: 'description', label: t(locale, 'exports.colDescription') },
    { key: 'date', label: t(locale, 'exports.colDate') },
    { key: 'amount', label: t(locale, 'exports.colAmount'), kind: 'money' },
    { key: 'customer', label: t(locale, 'exports.colCustomer') },
  ];
  const exportFileBase = `everyjob-money-activity-${new Date().toISOString().slice(0, 10)}`;

  return (
    <MoneyClient
      stats={{
        outstandingCents,
        incomeCents,
        expensesCents,
        netCents: incomeCents - expensesCents,
      }}
      activity={activity}
      currency={business?.currency}
      locale={locale}
      exportColumns={exportColumns}
      exportFileBase={exportFileBase}
      unpaidInvoices={unpaidInvoices}
      customers={modalCustomers}
      taxConfig={getTaxConfig(business?.regionCode, business?.taxRegion)}
      gstHstRegistered={business?.gstHstRegistered ?? false}
    />
  );
}
