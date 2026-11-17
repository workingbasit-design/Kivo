'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Plus, FileText, Pencil, Trash2, ClipboardList, Clock } from '@/components/icons';
import { fillTemplate, daysWaiting } from '@/lib/revenue';
import { Card, Button, SearchField } from '@/components/kit';
import { formatDateShort, cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import MoneyText from '@/components/MoneyText';
import DateTimeText from '@/components/DateTimeText';
import { QUOTE_STATUSES } from '@/lib/validations';
import { QUOTE_TRANSITIONS } from '@/lib/quote-status';
import { t, type Locale } from '@/lib/i18n';
import SmsButton from '@/components/SmsButton';
import WhatsAppButton from '@/components/WhatsAppButton';
import ExportButtons, { type ExportColumn, type ExportRow } from '@/components/ExportButtons';
import { StatusPill } from '../_components/status-ui';
import ConfirmDialog from '@/components/ConfirmDialog';
import { updateQuoteStatus, deleteQuote } from '@/app/actions/quotes';
import { clearLastOpenedRecord } from '@/lib/continue-candidate';
import NewQuoteModal from '@/components/NewQuoteModal';
import QuoteTemplatesModal from '@/components/QuoteTemplatesModal';
import type { TaxConfig } from '@/lib/tax';

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
  /** Slice 5: ISO string or null (serialized across the server boundary). */
  expiresAt: string | null;
  /** Slice 5: computed server-side (Date.now() is impure in JSX). */
  expired: boolean;
  /**
   * 2026-11-05: true when a job already exists from this quote (derived
   * server-side from the conversion marker on job notes). Converted quotes
   * keep APPROVED by design but are NOT open pipeline.
   */
  converted: boolean;
};

export type StaleQuoteItem = {
  id: string;
  number: string;
  total: number;
  updatedAt: string | Date;
  customer: { name: string; phone: string | null };
};

export type QuoteTemplateOption = {
  id: string;
  name: string;
  items: { desc: string; qty: string; rate: string; cost: string }[];
};

/**
 * Quote list redesign (ChatGPT Quotes prototype, 2026-11-17): eyebrow
 * header with the open-pipeline total, templates + export toolbar, live
 * search, status filter pills with counts, and quote cards with a file
 * mark, amount, status pill and hover actions — a status-change select
 * (only the transitions QUOTE_TRANSITIONS allows), an edit link to the
 * detail page, and delete behind a confirm dialog.
 *
 * All rows are real Prisma quotes; the follow-up queue, export and the
 * detail-page flows (send, approve/decline, convert, expiry, add-ons,
 * deposits, e-sign) are untouched. Creating a quote opens the New Quote
 * modal, which wraps the real QuoteForm + createQuote action.
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
  customers,
  taxConfig,
  templates,
  gstHstRegistered,
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
  /** For the New Quote modal (real QuoteForm). */
  customers: { id: string; name: string }[];
  taxConfig: TaxConfig;
  templates: QuoteTemplateOption[];
  gstHstRegistered: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState<Filter>(initialFilter);
  // 2026-11-06: quotes had no text search at all (status tabs only).
  const [query, setQuery] = useState('');
  // Local rows: status changes apply here at once, and quotes deleted
  // from this list are hidden here at once (the customers lesson: the
  // server re-render after a mutation can serve a stale snapshot).
  const [liveQuotes, setLiveQuotes] = useState<QuoteListItem[]>(quotes);
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const [newQuoteOpen, setNewQuoteOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [chosenTemplateId, setChosenTemplateId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<QuoteListItem | null>(null);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [, startTransition] = useTransition();

  const visibleQuotes = useMemo(
    () => liveQuotes.filter((q) => !hiddenIds.has(q.id)),
    [liveQuotes, hiddenIds]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: visibleQuotes.length };
    for (const s of QUOTE_STATUSES) {
      c[s] = visibleQuotes.filter((q) => q.status === s).length;
    }
    return c;
  }, [visibleQuotes]);

  const filtered = useMemo(() => {
    const byStatus =
      activeFilter === 'ALL'
        ? visibleQuotes
        : visibleQuotes.filter((q) => q.status === activeFilter);
    const q = query.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter(
      (quote) =>
        quote.number.toLowerCase().includes(q) ||
        quote.title.toLowerCase().includes(q) ||
        quote.customer.name.toLowerCase().includes(q)
    );
  }, [visibleQuotes, activeFilter, query]);

  // Open pipeline is a property of the whole book, not of the current
  // filter/search: SENT + APPROVED, excluding converted quotes (realized
  // work, not pipeline — 2026-11-05) and excluding DECLINED.
  const pipelineTotal = useMemo(
    () =>
      visibleQuotes
        .filter((q) => (q.status === 'SENT' || q.status === 'APPROVED') && !q.converted)
        .reduce((s, q) => s + q.total, 0),
    [visibleQuotes]
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
    visibleQuotes.length === 1
      ? t(locale, 'quotes.list.quoteOne')
      : t(locale, 'quotes.list.quoteOther');
  const subtitle = t(locale, 'quotes.list.subtitle')
    .replace('{count}', String(visibleQuotes.length))
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

  const changeStatus = (quote: QuoteListItem, next: string) => {
    if (next === quote.status || pendingStatusId) return;
    setPendingStatusId(quote.id);
    const fd = new FormData();
    fd.set('id', quote.id);
    fd.set('status', next);
    startTransition(async () => {
      try {
        const result = await updateQuoteStatus({}, fd);
        if (result?.error) {
          toast.error(result.error);
        } else {
          setLiveQuotes((list) =>
            list.map((q) => (q.id === quote.id ? { ...q, status: next } : q))
          );
          toast.success(
            t(locale, 'quotes.list.statusUpdated').replace(
              '{status}',
              filterLabels[next as Filter] ?? next
            )
          );
        }
      } finally {
        setPendingStatusId(null);
      }
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget || deletePending) return;
    const target = deleteTarget;
    setDeletePending(true);
    // Hide the row locally at once (see hiddenIds); the server action
    // redirects to /quotes, and the revalidated list catches up.
    setHiddenIds((prev) => new Set(prev).add(target.id));
    setDeleteTarget(null);
    const fd = new FormData();
    fd.set('id', target.id);
    // Never leave the Continue card pointing at this deleted quote.
    clearLastOpenedRecord(target.id);
    startTransition(async () => {
      try {
        await deleteQuote({}, fd);
      } catch {
        // deleteQuote redirects to /quotes on success; the navigation
        // itself is the success path, not an error to surface.
      } finally {
        setDeletePending(false);
      }
    });
  };

  const openNewQuote = (templateId = '') => {
    setChosenTemplateId(templateId);
    setTemplatesOpen(false);
    setNewQuoteOpen(true);
  };

  const isFiltered = query.trim() !== '' || activeFilter !== 'ALL';

  return (
    <div className="ej-quotes space-y-6">
      <header className="ej-quotes-header">
        <div className="min-w-0">
          <p className="ej-quotes-eyebrow">{t(locale, 'quotes.list.eyebrow')}</p>
          <h1>{t(locale, 'quotes.list.title')}</h1>
          <p className="ej-quotes-subtitle">{subtitle}</p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={() => openNewQuote()}
          className="ej-quotes-new"
        >
          <Plus size={16} aria-hidden="true" /> {t(locale, 'quotes.list.newQuote')}
        </Button>
      </header>

      <div className="ej-quotes-top-actions">
        <Button type="button" variant="secondary" onClick={() => setTemplatesOpen(true)}>
          <FileText size={15} aria-hidden="true" /> {t(locale, 'quotes.templates.title')}
        </Button>
        <ExportButtons
          columns={exportColumns}
          rows={exportRows}
          fileBase={exportFileBase}
          currency={business?.currency}
          locale={locale}
        />
      </div>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder={t(locale, 'quotes.list.searchPlaceholder')}
        label={t(locale, 'quotes.list.searchLabel')}
        clearLabel={t(locale, 'quotes.list.clearSearch')}
      />

      <div className="ej-quotes-filters" role="tablist" aria-label={t(locale, 'quotes.list.title')}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={activeFilter === f}
            onClick={() => switchFilter(f)}
            className={cn('ej-quotes-filter', activeFilter === f && 'active')}
          >
            <span>{filterLabels[f]}</span>
            {f !== 'ALL' && <small>{counts[f] ?? 0}</small>}
          </button>
        ))}
      </div>

      {/* Quote follow-up queue - revenue recovery. Only the user sends
          anything: buttons open their own SMS/WhatsApp apps prefilled. */}
      {staleQuotes.length > 0 && activeFilter === 'ALL' && query.trim() === '' && (
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
        <div className="ej-quotes-empty">
          <span className="ej-quotes-empty-icon">
            <ClipboardList size={23} aria-hidden="true" />
          </span>
          <h2>
            {isFiltered
              ? t(locale, 'quotes.list.noMatchingTitle')
              : t(locale, 'quotes.list.emptyTitle')}
          </h2>
          <p>
            {isFiltered
              ? t(locale, 'quotes.list.noMatchingDesc')
              : t(locale, 'quotes.list.emptyDesc')}
          </p>
          {isFiltered ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setQuery('');
                switchFilter('ALL');
              }}
            >
              {t(locale, 'quotes.list.clearFilters')}
            </Button>
          ) : (
            <Button type="button" variant="primary" onClick={() => openNewQuote()}>
              <Plus size={16} aria-hidden="true" /> {t(locale, 'quotes.list.newQuote')}
            </Button>
          )}
        </div>
      ) : (
        <div className="ej-quotes-list">
          {filtered.map((q) => {
            const transitions = QUOTE_TRANSITIONS[q.status] ?? [];
            return (
              <article className="ej-quote-card" key={q.id}>
                <Link href={`/quotes/${q.id}`} className="ej-quote-card-info">
                  <span className="ej-quote-mark">
                    <FileText size={17} aria-hidden="true" />
                  </span>
                  <span className="ej-quote-copy">
                    <b>
                      {q.number} · {q.title}
                    </b>
                    <small>
                      {q.customer.name} ·{' '}
                      <DateTimeText
                        date={q.createdAt}
                        variant="short"
                        timezone={business?.timezone ?? 'America/Toronto'}
                        locale={locale}
                      />
                      {q.expiresAt && q.status === 'SENT' && (
                        q.expired ? (
                          <span className="text-danger font-semibold">
                            {' '}· {t(locale, 'quotes.expiry.expired')}
                          </span>
                        ) : (
                          <span>
                            {' '}· {t(locale, 'quotes.expiry.validUntil')}{' '}
                            <DateTimeText
                              date={q.expiresAt}
                              variant="short"
                              timezone={business?.timezone ?? 'America/Toronto'}
                              locale={locale}
                            />
                          </span>
                        )
                      )}
                    </small>
                  </span>
                </Link>
                <div className="ej-quote-card-right">
                  <b className="ej-quote-amount">
                    <MoneyText dollars={q.total} locale={locale} />
                  </b>
                  <StatusPill status={q.status} locale={locale} />
                  <div className="ej-quote-card-actions">
                    {transitions.length > 0 && (
                      <select
                        className="ej-quote-status-select"
                        aria-label={t(locale, 'quotes.list.changeStatusFor').replace(
                          '{number}',
                          q.number
                        )}
                        value={q.status}
                        disabled={pendingStatusId === q.id}
                        onChange={(e) => changeStatus(q, e.target.value)}
                      >
                        <option value={q.status}>
                          {filterLabels[q.status as Filter] ?? q.status}
                        </option>
                        {transitions.map((s) => (
                          <option key={s} value={s}>
                            {filterLabels[s as Filter] ?? s}
                          </option>
                        ))}
                      </select>
                    )}
                    <Link
                      href={`/quotes/${q.id}`}
                      className="ej-quote-icon-action"
                      aria-label={`${t(locale, 'quotes.list.editQuote')} ${q.number}`}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </Link>
                    {q.status !== 'APPROVED' && (
                      <button
                        type="button"
                        className="ej-quote-icon-action danger"
                        onClick={() => setDeleteTarget(q)}
                        aria-label={`${t(locale, 'quotes.list.deleteQuote')} ${q.number}`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="ej-quotes-footnote">
        <span className="ej-quotes-footnote-dot" aria-hidden="true" />
        {t(locale, 'quotes.list.shownFootnote')
          .replace('{count}', String(filtered.length))
          .replace(
            '{quoteWord}',
            filtered.length === 1
              ? t(locale, 'quotes.list.quoteOne')
              : t(locale, 'quotes.list.quoteOther')
          )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          open
          locale={locale}
          title={t(locale, 't10money.quoteDeleteTitle')}
          message={t(locale, 't10money.quoteDeleteMsg')}
          busy={deletePending}
          onConfirm={confirmDelete}
          onClose={() => !deletePending && setDeleteTarget(null)}
        />
      )}

      {newQuoteOpen && (
        <NewQuoteModal
          customers={customers}
          taxConfig={taxConfig}
          templates={templates}
          locale={locale}
          gstHstRegistered={gstHstRegistered}
          initialTemplateId={chosenTemplateId}
          onClose={() => setNewQuoteOpen(false)}
        />
      )}

      {templatesOpen && (
        <QuoteTemplatesModal
          templates={templates.map((tpl) => ({
            id: tpl.id,
            name: tpl.name,
            itemCount: tpl.items.length,
          }))}
          locale={locale}
          onChoose={openNewQuote}
          onClose={() => setTemplatesOpen(false)}
        />
      )}
    </div>
  );
}
