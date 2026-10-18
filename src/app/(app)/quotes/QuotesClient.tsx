'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Plus, ClipboardList, Clock } from '@/components/icons';
import { fillTemplate, daysWaiting } from '@/lib/revenue';
import { Card, Button } from '@/components/kit';
import { formatDateShort, cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import MoneyText from '@/components/MoneyText';
import DateTimeText from '@/components/DateTimeText';
import { QUOTE_STATUSES } from '@/lib/validations';
import { t, type Locale } from '@/lib/i18n';
import SmsButton from '@/components/SmsButton';
import WhatsAppButton from '@/components/WhatsAppButton';
import ExportButtons, { type ExportColumn, type ExportRow } from '@/components/ExportButtons';
import { PageHeader, EmptyState } from '@/components/kit';
import { StatusPill } from '../_components/status-ui';

const FILTERS = ['ALL', ...QUOTE_STATUSES] as const;
type Filter = (typeof FILTERS)[number];

export type QuoteListItem = {
  id: string;
  number: string;
  title: string;
  total: number;
  status: string;
  createdAt: string | Date;
  customer: { name: string };
};

export type StaleQuoteItem = {
  id: string;
  number: string;
  total: number;
  updatedAt: string | Date;
  customer: { name: string; phone: string | null };
};

/**
 * Quote list with instant client-side tab filtering. The server sends all
 * quotes once; switching tabs filters in memory - no navigation, no
 * server roundtrip, no lag.
 */
export default function QuotesClient({
  quotes,
  staleQuotes,
  followupLinks,
  business,
  locale,
  exportColumns,
  exportFileBase,
  filterLabels,
  initialFilter,
}: {
  quotes: QuoteListItem[];
  staleQuotes: StaleQuoteItem[];
  followupLinks: Record<string, string>;
  business: { currency?: string | null; name?: string | null; regionCode?: string | null; timezone?: string | null } | null;
  locale: Locale;
  exportColumns: ExportColumn[];
  exportFileBase: string;
  filterLabels: Record<Filter, string>;
  initialFilter: Filter;
}) {
  const [activeFilter, setActiveFilter] = useState<Filter>(initialFilter);

  const filtered = useMemo(
    () =>
      activeFilter === 'ALL'
        ? quotes
        : quotes.filter((q) => q.status === activeFilter),
    [quotes, activeFilter]
  );

  const pipelineTotal = useMemo(
    () =>
      filtered
        .filter((q) => q.status === 'SENT' || q.status === 'APPROVED')
        .reduce((s, q) => s + q.total, 0),
    [filtered]
  );

  const exportRows: ExportRow[] = useMemo(
    () =>
      filtered.map((q) => ({
        number: q.number,
        title: q.title,
        customer: q.customer.name,
        date: formatDateShort(q.createdAt),
        status: q.status,
        total: q.total,
      })),
    [filtered]
  );

  const quoteWord =
    filtered.length === 1
      ? t(locale, 'quotes.list.quoteOne')
      : t(locale, 'quotes.list.quoteOther');
  const subtitle = t(locale, 'quotes.list.subtitle')
    .replace('{count}', String(filtered.length))
    .replace('{quoteWord}', quoteWord)
    .replace('{pipeline}', formatMoney(pipelineTotal, business?.currency));

  const switchFilter = (f: Filter) => {
    setActiveFilter(f);
    // Keep the URL truthful (refresh/bookmark keeps the tab) without
    // triggering a Next.js navigation.
    const url = f === 'ALL' ? '/quotes' : `/quotes?status=${f}`;
    window.history.replaceState(null, '', url);
  };

  const linkFor = (id: string) => followupLinks[id] ?? `/quotes/${id}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, 'quotes.list.title')}
        summary={subtitle}
        actionLabel={t(locale, 'quotes.list.newQuote')}
        actionHref="/quotes/new"
        actionIcon={Plus}
      />
      <div className="flex flex-wrap gap-2">
        <ExportButtons
          columns={exportColumns}
          rows={exportRows}
          fileBase={exportFileBase}
          currency={business?.currency}
          locale={locale}
        />
      </div>

      <div className="flex gap-2 flex-wrap" role="tablist" aria-label={t(locale, 'quotes.list.title')}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={activeFilter === f}
            onClick={() => switchFilter(f)}
            className={cn(
              'min-h-[44px] inline-flex items-center px-4 rounded-full text-xs font-semibold border transition-colors',
              activeFilter === f
                ? 'bg-asphalt text-hero-ink border-asphalt'
                : 'bg-surface text-ink-2 border-line hover:border-line-strong'
            )}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Quote follow-up queue - revenue recovery. Only the user sends
          anything: buttons open their own SMS/WhatsApp apps prefilled. */}
      {staleQuotes.length > 0 && activeFilter === 'ALL' && (
        <Card className="!p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-info/10 text-info">
                <Clock className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 className="font-semibold">
                  {t(locale, 't10money.followups.title')}{' '}
                  <span className="text-sm font-bold text-info">({staleQuotes.length})</span>
                </h2>
                <p className="text-xs text-ink-2">{t(locale, 't10money.followups.desc')}</p>
              </div>
            </div>
          </div>
          <ul className="divide-y divide-line">
            {staleQuotes.map((q) => {
              const waitingDays = Math.max(1, daysWaiting(new Date(q.updatedAt)));
              const message = fillTemplate(t(locale, 't10money.followups.message'), {
                customerName: q.customer.name,
                businessName: business?.name ?? '',
                number: q.number,
                amount: formatMoney(q.total, business?.currency),
                signLink: linkFor(q.id),
              });
              return (
                <li key={q.id} className="px-4 sm:px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">
                        <Link href={`/quotes/${q.id}`} className="hover:underline">
                          {q.number}
                        </Link>
                        <span className="font-normal text-ink-2"> · {q.customer.name}</span>
                      </p>
                      <p className="text-xs text-ink-2 mt-1 tabular-nums">
                        <span className="font-semibold text-info">
                          {t(locale, 't10money.followups.daysWaiting').replace(
                            '{days}',
                            String(waitingDays),
                          )}
                        </span>
                        {' · '}
                        <MoneyText dollars={q.total} locale={locale} />
                      </p>
                    </div>
                  </div>
                  <details className="mt-2 group">
                    <summary className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-info hover:underline min-h-[32px]">
                      {t(locale, 't10money.followups.sendFollowup')}
                    </summary>
                    <div className="mt-2 rounded-xl bg-surface-2 border border-line p-3 space-y-3">
                      <p className="text-xs text-ink whitespace-pre-wrap">{message}</p>
                      {q.customer.phone ? (
                        <div className="flex flex-wrap gap-2">
                          <SmsButton
                            phone={q.customer.phone}
                            regionCode={business?.regionCode}
                            message={message}
                            label={t(locale, 't10money.reminders.smsLabel')}
                          />
                          <WhatsAppButton
                            phone={q.customer.phone}
                            regionCode={business?.regionCode}
                            message={message}
                            label={t(locale, 't10money.reminders.waLabel')}
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-ink-2">
                          {t(locale, 't10money.reminders.noPhone')}
                        </p>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
          <div className="px-5 py-3 border-t border-line">
            <Button type="button" onClick={() => switchFilter('SENT')} variant="secondary">
              {t(locale, 't10money.followups.viewAll')}
            </Button>
          </div>
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={t(locale, 'quotes.list.emptyTitle')}
            text={t(locale, 'quotes.list.emptyDesc')}
          />
<div className="flex justify-center pb-10 -mt-6">
            <Button href="/quotes/new" variant="primary">
              <Plus size={14} /> {t(locale, 'quotes.list.newQuote')}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <ul className="divide-y divide-line">
            {filtered.map((q, i) => (
              <li
                key={q.id}
                className="ej-row-in"
                style={{ '--row-delay': `${Math.min(i, 12) * 35}ms` } as CSSProperties}
              >
                <Link
                  href={`/quotes/${q.id}`}
                  className="flex items-center justify-between gap-4 px-4 sm:px-5 py-4 hover:bg-surface-2 active:bg-surface-2 transition-colors min-h-[76px]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">
                      {q.number} · {q.title}
                    </p>
                    <p className="text-xs text-ink-2 mt-1">
                      {q.customer.name} · <DateTimeText date={q.createdAt} variant="short" timezone={business?.timezone ?? 'America/Toronto'} locale={locale} />
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-sm font-bold text-ink tabular-nums"><MoneyText dollars={q.total} locale={locale} /></span>
                    <StatusPill status={q.status} locale={locale} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
