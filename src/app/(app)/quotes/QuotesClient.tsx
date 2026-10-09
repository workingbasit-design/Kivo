'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Plus, ClipboardList, Clock } from 'lucide-react';
import { fillTemplate, daysWaiting } from '@/lib/revenue';
import { PageHeader, Card, StatusBadge, EmptyState, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import { formatDateShort, cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { QUOTE_STATUSES } from '@/lib/validations';
import { t, type Locale } from '@/lib/i18n';
import SmsButton from '@/components/SmsButton';
import WhatsAppButton from '@/components/WhatsAppButton';
import ExportButtons, { type ExportColumn, type ExportRow } from '@/components/ExportButtons';

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
 * quotes once; switching tabs filters in memory — no navigation, no
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
  business: { currency?: string | null; name?: string | null; regionCode?: string | null } | null;
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
        subtitle={subtitle}
        actions={
          <>
            <ExportButtons
              columns={exportColumns}
              rows={exportRows}
              fileBase={exportFileBase}
              currency={business?.currency}
              locale={locale}
            />
            <Link href="/quotes/new" className={primaryBtnClass}>
              <Plus size={14} /> {t(locale, 'quotes.list.newQuote')}
            </Link>
          </>
        }
      />

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
                ? 'bg-ink text-white border-ink'
                : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
            )}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Quote follow-up queue — revenue recovery. Only the user sends
          anything: buttons open their own SMS/WhatsApp apps prefilled. */}
      {staleQuotes.length > 0 && activeFilter === 'ALL' && (
        <Card className="!p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                <Clock className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 className="font-semibold">
                  {t(locale, 't10money.followups.title')}{' '}
                  <span className="text-sm font-bold text-violet-700">({staleQuotes.length})</span>
                </h2>
                <p className="text-xs text-zinc-500">{t(locale, 't10money.followups.desc')}</p>
              </div>
            </div>
          </div>
          <ul className="divide-y divide-zinc-100">
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
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        <Link href={`/quotes/${q.id}`} className="hover:underline">
                          {q.number}
                        </Link>
                        <span className="font-normal text-zinc-500"> · {q.customer.name}</span>
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        <span className="font-semibold text-violet-700">
                          {t(locale, 't10money.followups.daysWaiting').replace(
                            '{days}',
                            String(waitingDays),
                          )}
                        </span>
                        {' · '}
                        {formatMoney(q.total, business?.currency)}
                      </p>
                    </div>
                  </div>
                  <details className="mt-2 group">
                    <summary className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-sky-700 hover:underline min-h-[32px]">
                      {t(locale, 't10money.followups.sendFollowup')}
                    </summary>
                    <div className="mt-2 rounded-xl bg-zinc-50 border border-zinc-200 p-3 space-y-3">
                      <p className="text-xs text-zinc-700 whitespace-pre-wrap">{message}</p>
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
                        <p className="text-xs text-zinc-500">
                          {t(locale, 't10money.reminders.noPhone')}
                        </p>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
          <div className="px-5 py-3 border-t border-zinc-100">
            <button type="button" onClick={() => switchFilter('SENT')} className={secondaryBtnClass}>
              {t(locale, 't10money.followups.viewAll')}
            </button>
          </div>
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList size={24} />}
            title={t(locale, 'quotes.list.emptyTitle')}
            description={t(locale, 'quotes.list.emptyDesc')}
            action={
              <Link href="/quotes/new" className={primaryBtnClass}>
                <Plus size={14} /> {t(locale, 'quotes.list.newQuote')}
              </Link>
            }
          />
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <ul className="divide-y divide-zinc-100">
            {filtered.map((q, i) => (
              <li
                key={q.id}
                className="ej-row-in"
                style={{ '--row-delay': `${Math.min(i, 12) * 35}ms` } as CSSProperties}
              >
                <Link
                  href={`/quotes/${q.id}`}
                  className="flex items-center justify-between gap-4 px-4 sm:px-5 py-4 hover:bg-zinc-50 active:bg-zinc-100 transition-colors min-h-[76px]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">
                      {q.number} · {q.title}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {q.customer.name} · {formatDateShort(q.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-sm font-bold text-zinc-900">{formatMoney(q.total, business?.currency)}</span>
                    <StatusBadge status={q.status} />
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
