'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, ReceiptText, Pencil, Trash2, Receipt } from '@/components/icons';
import { statusLabel, localeMoneyTag } from '@/lib/utils';
import { formatDateShort, cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { countsAsMoney } from '@/lib/invoice-status';
import { isValidVoidReason } from '@/lib/voiding';
import MoneyText from '@/components/MoneyText';
import DateTimeText from '@/components/DateTimeText';
import { t, type Locale } from '@/lib/i18n';
import { INVOICE_STATUSES } from '@/lib/validations';
import ExportButtons, { type ExportColumn, type ExportRow } from '@/components/ExportButtons';
import { Button, Chip, SearchField, Textarea } from '@/components/kit';
import { StatusPill } from '../_components/status-ui';
import ConfirmDialog from '@/components/ConfirmDialog';
import { deleteInvoice, voidInvoice, type ActionResult } from '@/app/actions/invoices';
import { clearLastOpenedRecord } from '@/lib/continue-candidate';
import NewInvoiceModal from '@/components/NewInvoiceModal';
import type { TaxConfig } from '@/lib/tax';

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
 * Invoice list redesign (ChatGPT Invoices prototype, 2026-11-17): eyebrow
 * header, export + batch toolbar, Outstanding / Collected summary, live
 * search, status filter pills with counts, and connected invoice rows
 * with a receipt mark, amount, status pill and hover actions - an edit
 * link to the detail page, delete behind a confirm dialog (DRAFT only,
 * per the launch-pack rule) and void behind a reason dialog (every other
 * live status, reason of at least 10 characters).
 *
 * Deliberate deviation: the prototype's per-row status select is NOT
 * ported. Invoice status is derived from money - PAID can only come from
 * a recorded payment, and the old hand-set "Mark partially paid" button
 * was removed 2026-09-28 because it created a dishonest PARTIALLY PAID
 * with $0 paid. The prototype's Void option is ported as the real void
 * dialog instead.
 *
 * All rows are real Prisma invoices; the batch page, export and the
 * detail-page flows (payments, void, share, email, print) are untouched.
 * Creating an invoice opens the New Invoice modal, which wraps the real
 * InvoiceForm + createInvoice action.
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
  filterLabels,
  customers,
  taxConfig,
  gstHstRegistered,
}: {
  invoices: InvoiceListItem[];
  outstanding: number;
  collected: number;
  currency?: string | null;
  locale: Locale;
  exportColumns: ExportColumn[];
  exportFileBase: string;
  initialFilter: Filter;
  filterLabels: Record<Filter, string>;
  /** For the New Invoice modal (real InvoiceForm). */
  customers: { id: string; name: string }[];
  taxConfig: TaxConfig;
  gstHstRegistered: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState<Filter>(initialFilter);
  // 2026-11-06: invoices had no text search at all (status tabs only).
  const [query, setQuery] = useState('');
  // Local rows: invoices deleted or voided from this list update here at
  // once (the customers lesson: the server re-render after a mutation can
  // serve a stale snapshot).
  const [liveInvoices, setLiveInvoices] = useState<InvoiceListItem[]>(invoices);
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceListItem | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [voidTarget, setVoidTarget] = useState<InvoiceListItem | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidPending, setVoidPending] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const visibleInvoices = useMemo(
    () => liveInvoices.filter((i) => !hiddenIds.has(i.id)),
    [liveInvoices, hiddenIds]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: visibleInvoices.length };
    for (const s of INVOICE_STATUSES) {
      c[s] = visibleInvoices.filter((i) => i.status === s).length;
    }
    return c;
  }, [visibleInvoices]);

  const filtered = useMemo(() => {
    const byStatus =
      activeFilter === 'ALL'
        ? visibleInvoices
        : visibleInvoices.filter((i) => i.status === activeFilter);
    const q = query.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter(
      (inv) =>
        inv.number.toLowerCase().includes(q) ||
        inv.customer.name.toLowerCase().includes(q)
    );
  }, [visibleInvoices, activeFilter, query]);
  // Snapshot "now" once per mount for the overdue hint below (lazy
  // initializer keeps the impure Date.now() out of the render path).
  const [now] = useState(() => Date.now());

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

  const confirmDelete = () => {
    if (!deleteTarget || deletePending) return;
    const target = deleteTarget;
    setDeletePending(true);
    // Hide the row locally at once (see hiddenIds); the server action
    // redirects to /invoices, and the revalidated list catches up.
    setHiddenIds((prev) => new Set(prev).add(target.id));
    setDeleteTarget(null);
    const fd = new FormData();
    fd.set('id', target.id);
    // Never leave the Continue card pointing at this deleted invoice.
    clearLastOpenedRecord(target.id);
    startTransition(async () => {
      try {
        await deleteInvoice({}, fd);
      } catch {
        // deleteInvoice redirects to /invoices on success; the navigation
        // itself is the success path, not an error to surface.
      } finally {
        setDeletePending(false);
      }
    });
  };

  const confirmVoid = async () => {
    if (!voidTarget || voidPending || !isValidVoidReason(voidReason)) return;
    const target = voidTarget;
    setVoidPending(true);
    setVoidError(null);
    try {
      const fd = new FormData();
      fd.set('id', target.id);
      fd.set('reason', voidReason.trim());
      // Direct call (not useActionState): voidInvoice returns { ok: true }
      // without redirecting, so the list updates in place.
      const result: ActionResult = await voidInvoice({} as ActionResult, fd);
      if (result?.error) {
        setVoidError(result.error);
      } else {
        setLiveInvoices((list) =>
          list.map((i) => (i.id === target.id ? { ...i, status: 'VOID' } : i))
        );
        setVoidTarget(null);
        setVoidReason('');
        toast.success(t(locale, 't10money.invVoided'));
        router.refresh();
      }
    } finally {
      setVoidPending(false);
    }
  };

  const isFiltered = query.trim() !== '' || activeFilter !== 'ALL';

  return (
    <div className="ej-invoices space-y-6">
      <header className="ej-invoices-header">
        <div className="min-w-0">
          <p className="ej-invoices-eyebrow">{t(locale, 'billing.listEyebrow')}</p>
          <h1>{t(locale, 'billing.listTitle')}</h1>
          <p className="ej-invoices-subtitle">{t(locale, 'billing.listSubtitle')}</p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={() => setNewInvoiceOpen(true)}
          className="ej-invoices-new"
        >
          <Plus size={16} aria-hidden="true" /> {t(locale, 'billing.newInvoice')}
        </Button>
      </header>

      <div className="ej-invoices-toolbar">
        <ExportButtons
          columns={exportColumns}
          rows={exportRows}
          fileBase={exportFileBase}
          currency={currency}
          locale={locale}
        />
        <Button variant="secondary" href="/invoices/batch">
          <Receipt size={14} aria-hidden="true" /> {t(locale, 'billing.batchTitle')}
        </Button>
      </div>

      <section className="ej-invoices-summary" aria-label={t(locale, 'billing.listTitle')}>
        <div className="ej-invoices-summary-metric">
          <span>{t(locale, 'billing.statOutstanding')}</span>
          <strong>{formatMoney(Math.round(outstanding * 100) / 100, currency, localeMoneyTag(locale))}</strong>
          <small>{t(locale, 'billing.statYetToCollect')}</small>
        </div>
        <div className="ej-invoices-summary-metric">
          <span>{t(locale, 'billing.statCollected')}</span>
          <strong>{formatMoney(Math.round(collected * 100) / 100, currency, localeMoneyTag(locale))}</strong>
          <small>{t(locale, 'billing.statPaymentsRecorded')}</small>
        </div>
      </section>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder={t(locale, 'billing.searchPlaceholder')}
        label={t(locale, 'billing.searchLabel')}
        clearLabel={t(locale, 'billing.clearSearch')}
      />

      <div className="ej-invoices-filters" role="tablist" aria-label={t(locale, 'billing.filterLabel')}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={activeFilter === f}
            onClick={() => switchFilter(f)}
            className={cn('ej-invoices-filter', activeFilter === f && 'active')}
          >
            <span>{filterLabels[f]}</span>
            {f !== 'ALL' && <small>{counts[f] ?? 0}</small>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="ej-invoices-empty">
          <span className="ej-invoices-empty-icon">
            <ReceiptText size={23} aria-hidden="true" />
          </span>
          <h2>
            {isFiltered
              ? t(locale, 'billing.noMatchingTitle')
              : t(locale, 'billing.listEmptyTitle')}
          </h2>
          <p>
            {isFiltered
              ? t(locale, 'billing.noMatchingDesc')
              : t(locale, 'billing.listEmptyDesc')}
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
              {t(locale, 'billing.clearFilters')}
            </Button>
          ) : (
            <Button type="button" variant="primary" onClick={() => setNewInvoiceOpen(true)}>
              <Plus size={16} aria-hidden="true" /> {t(locale, 'billing.newInvoice')}
            </Button>
          )}
        </div>
      ) : (
        <section className="ej-invoices-list">
          {filtered.map((inv, index) => {
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
              inv.status !== 'VOID' &&
              new Date(inv.date).getTime() < now - OVERDUE_MS;
            return (
              <article
                key={inv.id}
                className={cn('ej-invoice-card', index % 2 === 1 && 'ej-invoice-card-alt')}
              >
                <Link href={`/invoices/${inv.id}`} className="ej-invoice-info">
                  <span className="ej-invoice-icon">
                    <ReceiptText size={17} aria-hidden="true" />
                  </span>
                  <span className="ej-invoice-copy">
                    <b>
                      {inv.number} · {inv.customer.name}
                    </b>
                    <small>
                      <DateTimeText date={inv.date} variant="short" locale={locale} />
                      {due > 0 && inv.status !== 'PAID' && inv.status !== 'VOID' && (
                        <em className="due-text">
                          {' '}
                          · {t(locale, 'billing.dueSuffix').replace('{amount}', formatMoney(due, currency, localeMoneyTag(locale)))}
                        </em>
                      )}
                      {inv.status === 'VOID' && (
                        <em>
                          {' '}
                          · {statusLabel('VOID', locale)}
                        </em>
                      )}
                    </small>
                  </span>
                </Link>
                <div className="ej-invoice-right">
                  <b className="ej-invoice-amount">
                    <MoneyText dollars={inv.total} locale={locale} />
                  </b>
                  <span className="flex items-center gap-1.5">
                    {overdue && (
                      <Chip tone="warn">{t(locale, 't10money.overdue')}</Chip>
                    )}
                    <StatusPill status={inv.status} locale={locale} />
                  </span>
                  <div className="ej-invoice-actions">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="ej-invoice-icon-action"
                      aria-label={`${t(locale, 'billing.listTitle')} ${inv.number}`}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </Link>
                    {inv.status === 'DRAFT' && (
                      <button
                        type="button"
                        className="ej-invoice-icon-action danger"
                        onClick={() => setDeleteTarget(inv)}
                        aria-label={`${t(locale, 't10money.invDelete')} ${inv.number}`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    )}
                    {inv.status !== 'DRAFT' && inv.status !== 'VOID' && (
                      <button
                        type="button"
                        className="ej-invoice-icon-action danger"
                        onClick={() => {
                          setVoidTarget(inv);
                          setVoidReason('');
                          setVoidError(null);
                        }}
                        aria-label={`${t(locale, 't10money.invVoid')} ${inv.number}`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <div className="ej-invoices-footnote">
        <span className="ej-invoices-footnote-dot" aria-hidden="true" />
        {t(locale, 'billing.shownFootnote')
          .replace('{count}', String(filtered.length))
          .replace(
            '{invoiceWord}',
            filtered.length === 1
              ? t(locale, 'billing.invoiceOne')
              : t(locale, 'billing.invoiceOther')
          )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          open
          locale={locale}
          title={t(locale, 't10money.invDeleteTitle')}
          message={t(locale, 't10money.invDeleteMsg')}
          busy={deletePending}
          onConfirm={confirmDelete}
          onClose={() => !deletePending && setDeleteTarget(null)}
        />
      )}

      {voidTarget && (
        <ConfirmDialog
          open
          locale={locale}
          title={t(locale, 't10money.invVoidTitle')}
          message={t(locale, 't10money.invVoidMsg')}
          busy={voidPending}
          error={voidError}
          confirmLabel={t(locale, 't10money.invVoid')}
          confirmDisabled={!isValidVoidReason(voidReason)}
          onConfirm={confirmVoid}
          onClose={() => !voidPending && setVoidTarget(null)}
        >
          <div className="mt-4">
            <Textarea
              label={t(locale, 't10money.invVoidReason')}
              name="reason"
              rows={3}
              maxLength={500}
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder={t(locale, 't10money.invVoidReasonPh')}
            />
            {!isValidVoidReason(voidReason) && voidReason.length > 0 && (
              <p className="mt-1.5 text-[11px] text-warn-text">
                {t(locale, 't10money.invVoidReasonShort')}
              </p>
            )}
          </div>
        </ConfirmDialog>
      )}

      {newInvoiceOpen && (
        <NewInvoiceModal
          customers={customers}
          taxConfig={taxConfig}
          locale={locale}
          gstHstRegistered={gstHstRegistered}
          onClose={() => setNewInvoiceOpen(false)}
        />
      )}
    </div>
  );
}
