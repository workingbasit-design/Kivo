import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { canSeePrices } from '@/lib/roles';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { INVOICE_STATUSES } from '@/lib/validations';
import { centsToDollars } from '@/lib/money';
import InvoicesClient, { type InvoiceListItem } from './InvoicesClient';
import type { ExportColumn } from '@/components/ExportButtons';
import { parseListLimit, takeWithProbe, sliceListPage } from '@/lib/list-page';
import { ListMore } from '../_components/ListMore';

const FILTERS = ['ALL', ...INVOICE_STATUSES] as const;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; limit?: string }>;
}) {
  const { businessId, role } = await requireAuth();

  // SEE_PRICES gate: invoice totals and collected/outstanding aggregates
  // are money data. Viewers without the capability (technicians) are
  // bounced to their dashboard before any query runs.
  if (!canSeePrices(role)) {
    redirect('/dashboard');
  }

  const { status, limit: limitParam } = await searchParams;
  const limit = parseListLimit(limitParam);
  const initialFilter = FILTERS.includes(status as (typeof FILTERS)[number])
    ? (status as (typeof FILTERS)[number])
    : 'ALL';
  const locale = await getLocale();

  // M3: the rows are a bounded page (newest first), and tab switching still
  // filters that page in memory on the client. The headline money figures are
  // NOT derived from the page - they are summed by the database over every
  // matching row, so they stay exact no matter how few invoices are on
  // screen. (The old code fetched the whole table TWICE: once with every
  // invoice's payments for the list, and again for the totals.)
  const [business, fetchedRows, totalCount, unpaidTotals, collectedAgg, outstandingPaid] =
    await Promise.all([
      prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } }),
      prisma.invoice.findMany({
        where: { businessId },
        include: {
          customer: { select: { name: true } },
          payments: { select: { amountCents: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: takeWithProbe(limit),
      }),
      prisma.invoice.count({ where: { businessId } }),
      // Outstanding = sum of non-PAID invoice totals minus the money already
      // taken against them. Matches the previous arithmetic exactly (it had
      // no per-invoice clamp here).
      prisma.invoice.aggregate({
        where: { businessId, voidedAt: null, status: { not: 'PAID' } },
        _sum: { totalCents: true },
      }),
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          invoice: { businessId, voidedAt: null },
        },
        _sum: { amountCents: true },
      }),
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          invoice: { businessId, voidedAt: null, status: { not: 'PAID' } },
        },
        _sum: { amountCents: true },
      }),
    ]);

  const page = sliceListPage(fetchedRows, limit);
  const invoiceRows = page.rows;

  const invoices: InvoiceListItem[] = invoiceRows.map((inv) => ({
    id: inv.id,
    number: inv.number,
    total: centsToDollars(inv.totalCents),
    status: inv.status,
    date: inv.date.toISOString(),
    customer: { name: inv.customer.name },
    payments: inv.payments.map((p) => ({
      amount: centsToDollars(p.amountCents),
      status: p.status,
    })),
  }));

  const outstanding =
    centsToDollars(unpaidTotals._sum.totalCents ?? 0) -
    centsToDollars(outstandingPaid._sum.amountCents ?? 0);
  const collected = centsToDollars(collectedAgg._sum.amountCents ?? 0);

  const exportColumns: ExportColumn[] = [
    { key: 'number', label: t(locale, 'exports.colNumber') },
    { key: 'customer', label: t(locale, 'exports.colCustomer') },
    { key: 'date', label: t(locale, 'exports.colDate') },
    { key: 'status', label: t(locale, 'exports.colStatus') },
    { key: 'total', label: t(locale, 'exports.colTotal'), kind: 'money' },
  ];
  const exportFileBase = `everyjob-invoices-${new Date().toISOString().slice(0, 10)}`;

  return (
    <>
    <InvoicesClient
      invoices={invoices}
      outstanding={outstanding}
      collected={collected}
      currency={business?.currency}
      locale={locale}
      exportColumns={exportColumns}
      exportFileBase={exportFileBase}
      initialFilter={initialFilter}
    />
      <ListMore
        shown={invoices.length}
        total={totalCount}
        nextLimit={page.nextLimit}
        locale={locale}
        basePath="/invoices"
        params={{ status }}
      />
    </>
  );
}
