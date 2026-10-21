'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, FileText, Wallet, Receipt } from '@/components/icons';
import { statusLabel, localeMoneyTag } from '@/lib/utils';
import { formatDateShort, cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { countsAsMoney } from '@/lib/invoice-status';
import MoneyText from '@/components/MoneyText';
import DateTimeText from '@/components/DateTimeText';
import { t, type Locale } from '@/lib/i18n';
import { INVOICE_STATUSES } from '@/lib/validations';
import ExportButtons, { type ExportColumn, type ExportRow } from '@/components/ExportButtons';
import { PageHeader, Button, EmptyState, Chip, Card, SummaryCard } from '@/components/kit';
import { StatusPill } from '../_components/status-ui';

const FILTERS = ['ALL', ...INVOICE_STATUSES] as const;
type Filter = (typeof FILTERS)[number];

export type InvoiceListItem = {
  id: string;
  number: string;
  total: number;
  status: string;
  date: string | Date;
  customer: { name: string };
  payments: { amount: number; status: string }[];
};

const OVERDUE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Invoice list with instant client-side tab filtering. The server sends all
 * invoices once; switching tabs filters in memory - no navigation, no
 * server roundtrip, no lag.
 */
export default function InvoicesClient({
  invoices,
  outstanding,
  collected,
  currency,
  locale,
  exportColumns,
  exportFileBase,
  initialFilter,
}: {
  invoices: InvoiceListItem[];
  outstanding: number;
  collected: number;
  currency?: string | null;
  locale: Locale;
  exportColumns: ExportColumn[];
  exportFileBase: string;
  initialFilter: Filter;
}) {
  const [activeFilter, setActiveFilter] = useState<Filter>(initialFilter);
  // Snapshot "now" once per mount for the overdue hint below (lazy
  // initializer keeps the impure Date.now() out of the render path).
  const [now] = useState(() => Date.now());

  const filtered = useMemo(
    () =>
      activeFilter === 'ALL'
        ? invoices
        : invoices.filter((i) => i.status === activeFilter),
    [invoices, activeFilter]
  );

  const exportRows: ExportRow[] = useMemo(
    () =>
      filtered.map((inv) => ({
        number: inv.number,
        customer: inv.customer.name,
        date: formatDateShort(inv.date),
        status: inv.status,
        total: inv.total,
      })),
    [filtered]
  );

  const switchFilter = (f: Filter) => {
    setActiveFilter(f);
    // Keep the URL truthful (refresh/bookmark keeps the tab) without
    // triggering a Next.js navigation.
    const url = f === 'ALL' ? '/invoices' : `/invoices?status=${encodeURIComponent(f)}`;
    window.history.replaceState(null, '', url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, 'billing.listTitle')}
        summary={t(locale, 'billing.listSubtitle')}
        actionLabel={t(locale, 'billing.newInvoice')}
        actionHref="/invoices/new"
        actionIcon={<Plus />}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <ExportButtons
          columns={exportColumns}
          rows={exportRows}
          fileBase={exportFileBase}
          currency={currency}
          locale={locale}
        />
        <Button variant="secondary" sm href="/invoices/batch">
          <Receipt size={14} /> {t(locale, 'billing.batchTitle')}
        </Button>
      </div>

      <SummaryCard
        stats={[
          {
            label: t(locale, 'billing.statOutstanding'),
            value: formatMoney(Math.round(outstanding * 100) / 100, currency, localeMoneyTag(locale)),
            sub: t(locale, 'billing.statYetToCollect'),
          },
          {
            label: t(locale, 'billing.statCollected'),
            value: formatMoney(Math.round(collected * 100) / 100, currency, localeMoneyTag(locale)),
            sub: t(locale, 'billing.statPaymentsRecorded'),
          },
        ]}
      />

      <div className="flex gap-2 flex-wrap" role="tablist" aria-label={t(locale, 'billing.filterLabel')}>
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
            {statusLabel(f, locale)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="mb-28 md:mb-0">
          <EmptyState
            icon={<FileText />}
            title={t(locale, 'billing.listEmptyTitle')}
            text={t(locale, 'billing.listEmptyDesc')}
          />
<div className="flex justify-center pb-10 -mt-6">
            <Button href="/invoices/new" variant="primary">
              <Plus size={14} /> {t(locale, 'billing.newInvoice')}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <ul className="divide-y divide-line">
            {filtered.map((inv) => {
              // Voided payments are not money: they never reduce the row's
              // balance due (2026-10-21).
              const paid = inv.payments
                .filter((p) => countsAsMoney(p.status))
                .reduce((s, p) => s + p.amount, 0);
              const due = Math.round((inv.total - paid) * 100) / 100;
              // Usual 30-day payment terms - the Invoice model stores no
              // contractual due date, so this is a follow-up hint, not a legal state.
              const overdue =
                due > 0 &&
                inv.status !== 'PAID' &&
                new Date(inv.date).getTime() < now - OVERDUE_MS;
              return (
                <li key={inv.id}>
                  <Link
                    href={`/invoices/${inv.id}`}
                    className={cn(
                      'flex items-center justify-between gap-4 px-4 sm:px-5 py-4 hover:bg-surface-2 active:bg-surface-2 transition-colors min-h-[76px] border-l-4',
                      overdue ? 'border-l-rose-500' : 'border-l-transparent'
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">
                        {inv.number} · {inv.customer.name}
                      </p>
                      <p className="text-xs text-ink-2 mt-1 tabular-nums">
                        <DateTimeText date={inv.date} variant="short" locale={locale} />
                        {due > 0 && inv.status !== 'PAID' && (
                          <span className="text-warn-text font-semibold"> · {t(locale, 'billing.dueSuffix').replace('{amount}', formatMoney(due, currency, localeMoneyTag(locale)))}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-sm font-bold text-ink tabular-nums"><MoneyText dollars={inv.total} locale={locale} /></span>
                      <span className="flex items-center gap-1.5">
                        {overdue && (
                          <Chip tone="warn">{t(locale, 't10money.overdue')}</Chip>
                        )}
                        <StatusPill status={inv.status} locale={locale} />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
