import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { canSeePrices } from '@/lib/roles';
import { FOLLOWUP_AFTER_DAYS, DAY_MS } from '@/lib/revenue';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { getActiveShareToken } from '@/lib/share';
import { QUOTE_STATUSES } from '@/lib/validations';
import { centsToDollars } from '@/lib/money';
import { isQuoteExpired } from '@/lib/quote-expiry';
import { convertedQuoteNumbers } from '@/lib/quotes';
import QuotesClient, { type QuoteListItem, type StaleQuoteItem } from './QuotesClient';
import type { ExportColumn } from '@/components/ExportButtons';
import { parseListLimit, takeWithProbe, sliceListPage } from '@/lib/list-page';
import { ListMore } from '../_components/ListMore';

const FILTERS = ['ALL', ...QUOTE_STATUSES] as const;

/**
 * Follow-up threshold, evaluated fresh per request. Plain module helper
 * (not a component) so the impure Date.now() stays out of render.
 */
function followupThreshold(): Date {
  return new Date(Date.now() - FOLLOWUP_AFTER_DAYS * DAY_MS);
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; limit?: string }>;
}) {
  const { businessId, role } = await requireAuth();

  // SEE_PRICES gate: quote totals are money data. Viewers without the
  // capability (technicians) are bounced to their dashboard before any
  // query runs.
  if (!canSeePrices(role)) {
    redirect('/dashboard');
  }

  const { status, limit: limitParam } = await searchParams;
  const limit = parseListLimit(limitParam);
  const initialFilter = FILTERS.includes(status as (typeof FILTERS)[number])
    ? (status as (typeof FILTERS)[number])
    : 'ALL';
  const locale: Locale = await getLocale();

  // M3: the quote list is a bounded page (newest first); tab switching still
  // filters that page in memory on the client. `totalQuotes` is an exact
  // database count so the footer can say how much is not on screen.
  const [business, fetchedQuotes, totalQuotes, convertedJobs, staleRows] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { currency: true, name: true, regionCode: true, timezone: true },
    }),
    prisma.quote.findMany({
      where: { businessId },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: takeWithProbe(limit),
    }),
    prisma.quote.count({ where: { businessId } }),
    // 2026-11-05: jobs stamped with the conversion marker, so converted
    // quotes can be excluded from the open-pipeline total (they keep
    // APPROVED by design). Tenant-scoped like every other query here.
    prisma.job.findMany({
      where: { businessId, notes: { startsWith: 'Converted from quote ' } },
      select: { notes: true },
    }),
    // Follow-up queue: SENT quotes waiting >3 days, longest-waiting first.
    prisma.quote.findMany({
      where: {
        businessId,
        status: 'SENT',
        updatedAt: { lt: followupThreshold() },
      },
      select: {
        id: true,
        number: true,
        totalCents: true,
        updatedAt: true,
        customer: { select: { name: true, phone: true } },
      },
      orderBy: { updatedAt: 'asc' },
      take: 5,
    }),
  ]);

  const quotePage = sliceListPage(fetchedQuotes, limit);
  const quoteRows = quotePage.rows;

  const convertedNumbers = convertedQuoteNumbers(convertedJobs.map((j) => j.notes));
  const quotes: QuoteListItem[] = quoteRows.map((q) => ({
    id: q.id,
    number: q.number,
    title: q.title,
    total: centsToDollars(q.totalCents),
    status: q.status,
    createdAt: q.createdAt.toISOString(),
    customer: { name: q.customer.name },
    expiresAt: q.expiresAt ? q.expiresAt.toISOString() : null,
    expired: isQuoteExpired({ status: q.status, expiresAt: q.expiresAt }),
    converted: convertedNumbers.has(q.number),
  }));

  const staleQuotes: StaleQuoteItem[] = staleRows.map((q) => ({
    id: q.id,
    number: q.number,
    total: centsToDollars(q.totalCents),
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
    <>
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
      <ListMore
        shown={quotes.length}
        total={totalQuotes}
        nextLimit={quotePage.nextLimit}
        locale={locale}
        basePath="/quotes"
        params={{ status }}
      />
    </>
  );
}
