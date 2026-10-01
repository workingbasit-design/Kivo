'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, FileText, Wallet, Receipt } from 'lucide-react';
import { PageHeader, Card, StatusBadge, EmptyState, StatCard, Badge, primaryBtnClass } from '@/components/ui';
import { formatDateShort, cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { t, type Locale } from '@/lib/i18n';
import { INVOICE_STATUSES } from '@/lib/validations';
import ExportButtons, { type ExportColumn, type ExportRow } from '@/components/ExportButtons';

const FILTERS = ['ALL', ...INVOICE_STATUSES] as const;
type Filter = (typeof FILTERS)[number];

export type InvoiceListItem = {
  id: string;
  number: string;
  total: number;
  status: string;
  date: string | Date;
  customer: { name: string };
  payments: { amount: number }[];
};

const OVERDUE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Invoice list with instant client-side tab filtering. The server sends all
 * invoices once; switching tabs filters in memory — no navigation, no
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
        title="Invoices"
        subtitle="Every payment, accounted for."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <ExportButtons
              columns={exportColumns}
              rows={exportRows}
              fileBase={exportFileBase}
              currency={currency}
              locale={locale}
            />
            <Link
              href="/invoices/batch"
              className="bg-white hover:bg-zinc-50 text-zinc-700 px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 border border-zinc-200 shadow-sm min-h-[44px]"
            >
              <Receipt size={14} /> {t(locale, 'billing.batchTitle')}
            </Link>
            <Link href="/invoices/new" className={primaryBtnClass}>
              <Plus size={14} /> New invoice
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Outstanding"
          value={formatMoney(Math.round(outstanding * 100) / 100, currency)}
          sub="yet to be collected"
          icon={<Wallet size={16} />}
          accent="bg-amber-100 text-amber-700"
        />
        <StatCard
          label="Collected"
          value={formatMoney(Math.round(collected * 100) / 100, currency)}
          sub="payments recorded"
          icon={<FileText size={16} />}
          accent="bg-emerald-100 text-emerald-700"
        />
      </div>

      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Invoice status filter">
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
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText size={24} />}
            title="No invoices yet"
            description="Raise a tax-ready invoice in under a minute — tax math handled for you."
            action={
              <Link href="/invoices/new" className={primaryBtnClass}>
                <Plus size={14} /> New invoice
              </Link>
            }
          />
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <ul className="divide-y divide-zinc-100">
            {filtered.map((inv) => {
              const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
              const due = Math.round((inv.total - paid) * 100) / 100;
              // Usual 30-day payment terms — the Invoice model stores no
              // contractual due date, so this is a follow-up hint, not a legal state.
              const overdue =
                due > 0 &&
                inv.status !== 'PAID' &&
                new Date(inv.date).getTime() < Date.now() - OVERDUE_MS;
              return (
                <li key={inv.id}>
                  <Link
                    href={`/invoices/${inv.id}`}
                    className={cn(
                      'flex items-center justify-between gap-4 px-4 sm:px-5 py-4 hover:bg-zinc-50 active:bg-zinc-100 transition-colors min-h-[76px] border-l-4',
                      overdue ? 'border-l-rose-500' : 'border-l-transparent'
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        {inv.number} · {inv.customer.name}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {formatDateShort(inv.date)}
                        {due > 0 && inv.status !== 'PAID' && (
                          <span className="text-amber-700 font-semibold"> · {formatMoney(due, currency)} due</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-sm font-bold text-zinc-900">{formatMoney(inv.total, currency)}</span>
                      <span className="flex items-center gap-1.5">
                        {overdue && (
                          <Badge tone="danger">{t(locale, 't10money.overdue')}</Badge>
                        )}
                        <StatusBadge status={inv.status} />
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
