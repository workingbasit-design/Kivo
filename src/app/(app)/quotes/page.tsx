import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { FOLLOWUP_AFTER_DAYS, DAY_MS } from '@/lib/revenue';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { getActiveShareToken } from '@/lib/share';
import { QUOTE_STATUSES } from '@/lib/validations';
import QuotesClient, { type QuoteListItem, type StaleQuoteItem } from './QuotesClient';
import type { ExportColumn } from '@/components/ExportButtons';

const FILTERS = ['ALL', ...QUOTE_STATUSES] as const;

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  const businessId = session.user.businessId;

  const { status } = await searchParams;
  const initialFilter = FILTERS.includes(status as (typeof FILTERS)[number])
    ? (status as (typeof FILTERS)[number])
    : 'ALL';
  const locale: Locale = await getLocale();

  // One fetch for everything: tab switching filters in memory on the client,
  // so switching tabs never hits the server.
  const [business, quoteRows, staleRows] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { currency: true, name: true, regionCode: true },
    }),
    prisma.quote.findMany({
      where: { businessId },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    // Follow-up queue: SENT quotes waiting >3 days, longest-waiting first.
    prisma.quote.findMany({
      where: {
        businessId,
        status: 'SENT',
        updatedAt: { lt: new Date(Date.now() - FOLLOWUP_AFTER_DAYS * DAY_MS) },
      },
      select: {
        id: true,
        number: true,
        total: true,
        updatedAt: true,
        customer: { select: { name: true, phone: true } },
      },
      orderBy: { updatedAt: 'asc' },
      take: 5,
    }),
  ]);

  const quotes: QuoteListItem[] = quoteRows.map((q) => ({
    id: q.id,
    number: q.number,
    title: q.title,
    total: q.total,
    status: q.status,
    createdAt: q.createdAt.toISOString(),
    customer: { name: q.customer.name },
  }));

  const staleQuotes: StaleQuoteItem[] = staleRows.map((q) => ({
    id: q.id,
    number: q.number,
    total: q.total,
    updatedAt: q.updatedAt.toISOString(),
    customer: { name: q.customer.name, phone: q.customer.phone },
  }));

  // Resolve each follow-up quote's public review-and-approve link (/q/[token])
  // when a usable share token exists; otherwise fall back to the detail page.
  const followupLinks: Record<string, string> = {};
  await Promise.all(
    staleRows.map(async (q) => {
      const rec = await getActiveShareToken(businessId, 'QUOTE', { quoteId: q.id });
      followupLinks[q.id] = rec ? `/q/${rec.token}` : `/quotes/${q.id}`;
    })
  );

  // Export columns are static per locale; rows are computed client-side from
  // the currently filtered list.
  const exportColumns: ExportColumn[] = [
    { key: 'number', label: t(locale, 'exports.colNumber') },
    { key: 'title', label: t(locale, 'exports.colTitle') },
    { key: 'customer', label: t(locale, 'exports.colCustomer') },
    { key: 'date', label: t(locale, 'exports.colDate') },
    { key: 'status', label: t(locale, 'exports.colStatus') },
    { key: 'total', label: t(locale, 'exports.colTotal'), kind: 'money' },
  ];
  const exportFileBase = `everyjob-quotes-${new Date().toISOString().slice(0, 10)}`;

  const filterLabels = {
    ALL: t(locale, 'quotes.list.filterAll'),
    DRAFT: t(locale, 'quotes.list.filterDraft'),
    SENT: t(locale, 'quotes.list.filterSent'),
    APPROVED: t(locale, 'quotes.list.filterApproved'),
    DECLINED: t(locale, 'quotes.list.filterDeclined'),
  } as Record<(typeof FILTERS)[number], string>;

  return (
    <QuotesClient
      quotes={quotes}
      staleQuotes={staleQuotes}
      followupLinks={followupLinks}
      business={business}
      locale={locale}
      exportColumns={exportColumns}
      exportFileBase={exportFileBase}
      filterLabels={filterLabels}
      initialFilter={initialFilter}
    />
  );
}
