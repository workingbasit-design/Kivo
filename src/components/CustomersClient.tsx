'use client';

import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Archive,
  ChevronDown,
  Download,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Upload,
  Users,
  X,
} from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import MoneyText from '@/components/MoneyText';
import { formatCents } from '@/lib/money';
import { StatusBadge } from '@/components/kit';
import {
  useExportDownloads,
  type ExportColumn,
  type ExportRow,
} from '@/components/ExportButtons';
import { archiveCustomer } from '@/app/actions/customers';
import type { PaymentSummary } from '@/lib/customer-payment-summary';
import CustomerModal from '@/components/CustomerModal';

/** Replace `{name}` tokens in a template string (minimal inline fill helper). */
function fill(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  province: string | null;
  postalCode: string | null;
  notes: string | null;
  tags: string[];
  jobCount: number;
  revenue: number;
};

/**
 * Customer list (Customers redesign, ChatGPT Customers prototype): the
 * prototype's header, pill search, Export / Import toolbar, tag filter
 * chips and expandable customer cards, fed by the server-loaded rows.
 * Search and tag filtering are client-side. Expanding a card auto-fetches
 * that customer's real payment position (balance due, unpaid invoices,
 * last payment, lifetime paid) from /api/customers/[id]/payment-summary —
 * never sample data. Add / Edit go through the CustomerModal and the real
 * create / update server actions. Archive uses the real archive action
 * (delete stays on the detail page, guarded by the archive + linked
 * records rule). CSV import links to /imports?type=customers, which is
 * preview-and-confirm — nothing is created silently.
 */
export default function CustomersClient({
  customers,
  currency,
  locale = 'en',
  totalCustomers,
}: {
  customers: CustomerRow[];
  currency?: string;
  locale?: Locale;
  /** Real total from the database (the list page is capped). */
  totalCustomers: number;
}) {
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalCustomer, setModalCustomer] = useState<CustomerRow | 'new' | null>(null);
  const [payById, setPayById] = useState<Record<string, PaymentSummary | 'loading' | 'error'>>({});
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const custL = (k: string) => t(locale, `customers.${k}`);
  const L = (path: string) => t(locale, `t10money.${path}`);

  // Cmd/Ctrl+K focuses search (same as Jobs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Distinct tags across this business's customers (tenant-safe: only this
  // business's customers are in `customers`), for the filter chips.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of customers) {
      for (const tag of c.tags ?? []) set.add(tag);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      if (activeTag && !(c.tags ?? []).includes(activeTag)) return false;
      if (!q) return true;
      return (
        (c.name ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.address ?? '').toLowerCase().includes(q)
      );
    });
  }, [customers, query, activeTag]);

  const hasFilter = query.trim() !== '' || activeTag !== null;
  const countLabel = fill(
    L(filtered.length === 1 ? 'custListCountOne' : 'custListCountMany'),
    { count: filtered.length },
  );
  const headerCount = custL(totalCustomers === 1 ? 'countOne' : 'countOther').replace(
    '{count}',
    String(totalCustomers),
  );

  // Export the *currently filtered* list (2026-09-24).
  const exportColumns: ExportColumn[] = useMemo(
    () => [
      { key: 'name', label: t(locale, 'exports.colName') },
      { key: 'phone', label: t(locale, 'exports.colPhone') },
      { key: 'email', label: t(locale, 'exports.colEmail') },
      { key: 'address', label: t(locale, 'exports.colAddress') },
      { key: 'tags', label: t(locale, 'exports.colTags') },
      { key: 'jobs', label: t(locale, 'exports.colJobs') },
      { key: 'revenue', label: t(locale, 'exports.colRevenue'), kind: 'money' },
    ],
    [locale],
  );
  const exportRows: ExportRow[] = useMemo(
    () =>
      filtered.map((c) => ({
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        tags: (c.tags ?? []).join(', '),
        jobs: c.jobCount,
        revenue: c.revenue,
      })),
    [filtered],
  );
  const exportFileBase = useMemo(
    () => `everyjob-customers-${new Date().toISOString().slice(0, 10)}`,
    [],
  );
  const { downloadCsv, busy: exportBusy, disabled: exportDisabled } = useExportDownloads({
    columns: exportColumns,
    rows: exportRows,
    fileBase: exportFileBase,
    currency,
    locale,
  });

  /** Expand a card; the first expand auto-fetches the real payment summary. */
  const toggleExpanded = (customer: CustomerRow) => {
    if (expandedId === customer.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(customer.id);
    if (payById[customer.id] === undefined) {
      setPayById((prev) => ({ ...prev, [customer.id]: 'loading' }));
      fetch(`/api/customers/${customer.id}/payment-summary`, {
        headers: { Accept: 'application/json' },
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((data: PaymentSummary) =>
          setPayById((prev) => ({ ...prev, [customer.id]: data })),
        )
        .catch(() =>
          setPayById((prev) => ({ ...prev, [customer.id]: 'error' })),
        );
    }
  };

  const archive = (customer: CustomerRow) => {
    if (archivingId) return;
    setArchivingId(customer.id);
    const fd = new FormData();
    fd.set('id', customer.id);
    startTransition(async () => {
      try {
        const result = await archiveCustomer({}, fd);
        if (result?.error) {
          toast.error(result.error);
        } else if (result?.ok) {
          toast.success(custL('customerArchived'));
          setExpandedId(null);
          // Navigate (same URL) instead of router.refresh(): the refresh
          // re-rendered a stale cached snapshot of the list in QA run 7
          // (Beta reappeared for 90s+ although the DB was correct). A
          // soft navigation re-fetches the route, exactly like the
          // modal create's redirect, which proved reliable in probe 4.
          router.replace('/customers');
        }
      } finally {
        setArchivingId(null);
      }
    });
  };

  const initials = (name: string) =>
    (name || 'C')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join('')
      .toUpperCase();

  const payPanel = (customer: CustomerRow) => {
    const pay = payById[customer.id];
    return (
      <div className="ej-customer-pay">
        <h3>{custL('paymentTitle')}</h3>
        {pay === undefined || pay === 'loading' ? (
          <p className="ej-customer-pay-loading">{custL('loadingPayments')}</p>
        ) : pay === 'error' ? (
          <p className="ej-customer-pay-loading">{custL('paymentLoadError')}</p>
        ) : (
          <div className="ej-customer-pay-grid">
            <div>
              <span>{custL('balanceDue')}</span>
              <b className={pay.balanceDueCents > 0 ? 'balance-due' : 'balance-ok'}>
                {formatCents(pay.balanceDueCents, currency, locale === 'fr' ? 'fr' : 'en')}
              </b>
            </div>
            <div>
              <span>{custL('unpaidInvoices')}</span>
              <b>{pay.unpaidCount}</b>
            </div>
            <div>
              <span>{custL('lastPayment')}</span>
              <b>
                {pay.lastPayment
                  ? formatCents(pay.lastPayment.amountCents, currency, locale === 'fr' ? 'fr' : 'en')
                  : custL('noPayments')}
              </b>
            </div>
            <div>
              <span>{custL('totalPaid')}</span>
              <b>{formatCents(pay.totalPaidCents, currency, locale === 'fr' ? 'fr' : 'en')}</b>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="ej-customers">
      <header className="ej-customers-header">
        <div className="min-w-0">
          <p className="ej-customers-eyebrow">{custL('eyebrow')}</p>
          <h1>{custL('title')}</h1>
          <p className="ej-customers-subtitle">{headerCount}</p>
        </div>
        <button
          type="button"
          className="ej-customers-new"
          onClick={() => setModalCustomer('new')}
        >
          <Plus size={18} aria-hidden="true" /> {custL('addCustomer')}
        </button>
      </header>

      <div className="ej-customers-toolbar">
        <label className="ej-customers-search">
          <Search size={18} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={custL('searchPlaceholder')}
            aria-label={custL('searchPlaceholder')}
          />
          {query !== '' && (
            <button
              type="button"
              className="ej-customers-search-clear"
              onClick={() => setQuery('')}
              aria-label={custL('clearSearch')}
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </label>
        <div className="ej-customers-actions">
          <button
            type="button"
            className="ej-customers-action"
            onClick={downloadCsv}
            disabled={exportDisabled}
          >
            <Download size={16} aria-hidden="true" />
            {exportBusy === 'csv' ? t(locale, 'exports.preparing') : t(locale, 'exports.csv')}
          </button>
          <Link href="/imports?type=customers" className="ej-customers-action">
            <Upload size={16} aria-hidden="true" /> {t(locale, 'exports.importBtn')}
          </Link>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="ej-customers-chips" role="group" aria-label={L('custListFilterTags')}>
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            aria-pressed={activeTag === null}
            className={`ej-customers-chip${activeTag === null ? ' active' : ''}`}
          >
            {L('custListAll')}
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              aria-pressed={activeTag === tag}
              className={`ej-customers-chip${activeTag === tag ? ' active' : ''}`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="ej-customers-list-heading">
        <span>
          {countLabel}
          {activeTag ? ` ${fill(L('custListTagged'), { tag: activeTag })}` : ''}
          {query.trim() ? ` ${fill(L('custListMatching'), { q: query.trim() })}` : ''}
          {hasFilter && (
            <button
              type="button"
              className="ej-customers-clear"
              onClick={() => {
                setActiveTag(null);
                setQuery('');
              }}
            >
              {custL('clearSearch')}
            </button>
          )}
        </span>
        <span className="ej-customers-list-note">{custL('directoryNote')}</span>
      </div>

      {filtered.length === 0 ? (
        <section className="ej-customers-empty">
          <span className="ej-customers-empty-icon" aria-hidden="true">
            <Users size={23} />
          </span>
          <h2>{hasFilter ? custL('noMatchingTitle') : custL('noCustomersTitle')}</h2>
          <p>{hasFilter ? custL('noMatchingText') : custL('noCustomersText')}</p>
          {hasFilter ? (
            <button
              type="button"
              className="ej-customers-btn"
              onClick={() => {
                setActiveTag(null);
                setQuery('');
              }}
            >
              {custL('clearSearch')}
            </button>
          ) : (
            <button
              type="button"
              className="ej-customers-btn primary"
              onClick={() => setModalCustomer('new')}
            >
              <Plus size={16} aria-hidden="true" /> {custL('addCustomer')}
            </button>
          )}
        </section>
      ) : (
        <section className="ej-customers-list">
          {filtered.map((c, i) => {
            const expanded = expandedId === c.id;
            return (
              <article
                key={c.id}
                className={`ej-customer-card${expanded ? ' expanded' : ''}`}
                style={{ '--row-delay': `${Math.min(i, 12) * 35}ms` } as React.CSSProperties}
              >
                <button
                  type="button"
                  className="ej-customer-card-main"
                  onClick={() => toggleExpanded(c)}
                  aria-expanded={expanded}
                >
                  <span className="ej-customer-avatar" aria-hidden="true">
                    {initials(c.name)}
                  </span>
                  <span className="ej-customer-identity">
                    <b>{c.name}</b>
                    <small>
                      {c.phone && (
                        <>
                          <Phone size={12} aria-hidden="true" />
                          {c.phone}
                        </>
                      )}
                      {c.email && (
                        <>
                          <Mail size={12} aria-hidden="true" />
                          {c.email}
                        </>
                      )}
                      {!c.phone && !c.email && <>{L('custListNoPhone')}</>}
                    </small>
                    {(c.tags ?? []).length > 0 && (
                      <span className="ej-customer-tags">
                        {(c.tags ?? []).map((tag) => (
                          <StatusBadge key={tag} tone="neutral">
                            {tag}
                          </StatusBadge>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="ej-customer-spend">
                    <b>
                      <MoneyText dollars={c.revenue} locale={locale} />
                    </b>
                    <small>
                      {fill(L(c.jobCount === 1 ? 'custListJobOne' : 'custListJobMany'), {
                        count: c.jobCount,
                      })}
                    </small>
                  </span>
                  <span className="ej-customer-expand" aria-hidden="true">
                    <ChevronDown size={16} />
                  </span>
                </button>
                {expanded && (
                  <div className="ej-customer-details">
                    <div className="ej-customer-detail-grid">
                      <div>
                        <span>{custL('phone')}</span>
                        <b>{c.phone ?? custL('notProvided')}</b>
                      </div>
                      <div>
                        <span>{custL('email')}</span>
                        <b>{c.email ?? custL('notProvided')}</b>
                      </div>
                      <div>
                        <span>{custL('address')}</span>
                        <b>{c.address ?? custL('notProvided')}</b>
                      </div>
                      <div>
                        <span>{custL('jobsBooked')}</span>
                        <b>{c.jobCount}</b>
                      </div>
                    </div>
                    {c.notes && <p className="ej-customer-notes">{c.notes}</p>}
                    {payPanel(c)}
                    <div className="ej-customer-detail-actions">
                      <button
                        type="button"
                        className="ej-customers-btn small"
                        onClick={() => setModalCustomer(c)}
                      >
                        <Pencil size={14} aria-hidden="true" /> {custL('editCustomer')}
                      </button>
                      <Link
                        href={`/customers/${c.id}`}
                        className="ej-customers-btn small"
                      >
                        {custL('viewDetails')}
                      </Link>
                      <button
                        type="button"
                        className="ej-customers-btn small"
                        onClick={() => archive(c)}
                        disabled={archivingId === c.id}
                      >
                        <Archive size={14} aria-hidden="true" />{' '}
                        {archivingId === c.id
                          ? t(locale, 't10money.custArchiving')
                          : t(locale, 't10money.custArchive')}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      <div className="ej-customers-footnote">
        <span className="ej-customers-footnote-dot" aria-hidden="true" />
        {custL('footnote')}
      </div>

      {modalCustomer && (
        <CustomerModal
          customer={modalCustomer === 'new' ? null : modalCustomer}
          locale={locale}
          onClose={() => setModalCustomer(null)}
        />
      )}
    </div>
  );
}
