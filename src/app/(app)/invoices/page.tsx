import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { INVOICE_STATUSES } from '@/lib/validations';
import { centsToDollars } from '@/lib/money';
import InvoicesClient, { type InvoiceListItem } from './InvoicesClient';
import type { ExportColumn } from '@/components/ExportButtons';

const FILTERS = ['ALL', ...INVOICE_STATUSES] as const;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { businessId } = await requireAuth();

  const { status } = await searchParams;
  const initialFilter = FILTERS.includes(status as (typeof FILTERS)[number])
    ? (status as (typeof FILTERS)[number])
    : 'ALL';
  const locale = await getLocale();

  // One fetch for everything: tab switching filters in memory on the client,
  // so switching tabs never hits the server.
  const [business, invoiceRows, aggregates] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } }),
    prisma.invoice.findMany({
      where: { businessId },
      include: {
        customer: { select: { name: true } },
        payments: { select: { amountCents: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.findMany({
      where: { businessId },
      select: { totalCents: true, status: true, payments: { select: { amountCents: true } } },
    }),
  ]);

  const invoices: InvoiceListItem[] = invoiceRows.map((inv) => ({
    id: inv.id,
    number: inv.number,
    total: centsToDollars(inv.totalCents),
    status: inv.status,
    date: inv.date.toISOString(),
    customer: { name: inv.customer.name },
    payments: inv.payments.map((p) => ({ amount: centsToDollars(p.amountCents) })),
  }));

  const outstanding = aggregates
    .filter((i) => i.status !== 'PAID')
    .reduce(
      (s, i) =>
        s +
        (centsToDollars(i.totalCents) -
          i.payments.reduce((p, pay) => p + centsToDollars(pay.amountCents), 0)),
      0
    );
  const collected = aggregates.reduce(
    (s, i) => s + i.payments.reduce((p, pay) => p + centsToDollars(pay.amountCents), 0),
    0
  );

  const exportColumns: ExportColumn[] = [
    { key: 'number', label: t(locale, 'exports.colNumber') },
    { key: 'customer', label: t(locale, 'exports.colCustomer') },
    { key: 'date', label: t(locale, 'exports.colDate') },
    { key: 'status', label: t(locale, 'exports.colStatus') },
    { key: 'total', label: t(locale, 'exports.colTotal'), kind: 'money' },
  ];
  const exportFileBase = `everyjob-invoices-${new Date().toISOString().slice(0, 10)}`;

  return (
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
  );
}
