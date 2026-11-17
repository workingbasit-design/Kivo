'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus,
  Wallet,
  ArrowDown,
  ArrowUp,
  TrendingUp,
  Download,
  ReceiptText,
  Briefcase,
  Sparkles,
  DollarSign,
  ChevronRight,
} from '@/components/icons';
import { formatCents } from '@/lib/money';
import { formatDateShort, localeMoneyTag, cn } from '@/lib/utils';
import { t, type Locale } from '@/lib/i18n';
import { filterMoneyActivity, type MoneyActivityItem } from '@/lib/money-hub';
import { useExportDownloads, type ExportColumn, type ExportRow } from '@/components/ExportButtons';
import { Button } from '@/components/kit';
import NewInvoiceModal from '@/components/NewInvoiceModal';
import MoneyEntryModal, { type SavedEntry } from './MoneyEntryModal';
import type { TaxConfig } from '@/lib/tax';

export type UnpaidInvoiceOption = {
  id: string;
  number: string;
  customerName: string;
  remainingCents: number;
};

export type MoneyStats = {
  outstandingCents: number;
  incomeCents: number;
  expensesCents: number;
  netCents: number;
};

type Filter = 'all' | 'income' | 'expense' | 'invoice';

const FILTERS: { key: Filter; labelKey: string }[] = [
  { key: 'all', labelKey: 't10money.money.filterAll' },
  { key: 'income', labelKey: 't10money.money.filterIncome' },
  { key: 'expense', labelKey: 't10money.money.filterExpenses' },
  { key: 'invoice', labelKey: 't10money.money.filterInvoices' },
];

/**
 * Money hub redesign (ChatGPT Money prototype, 2026-11-17): eyebrow
 * header, four overview metrics, payment activity with kind filters and
 * CSV export, empty state with quick entry points, and quick actions.
 * New invoice opens the real NewInvoiceModal; Record payment and Add
 * expense open the MoneyEntryModal, which calls the real recordPayment
 * and createExpense server actions.
 *
 * All rows and figures are real Prisma records (see page.tsx). The
 * client keeps a live copy of the activity + stats so a record created
 * in this session shows at once; the server re-render after
 * router.refresh() replaces it with server truth, so a record is never
 * shown twice.
 */
export default function MoneyClient({
  stats,
  activity,
  currency,
  locale,
  exportColumns,
  exportFileBase,
  unpaidInvoices,
  customers,
  taxConfig,
  gstHstRegistered,
}: {
  stats: MoneyStats;
  activity: MoneyActivityItem[];
  currency?: string | null;
  locale: Locale;
  exportColumns: ExportColumn[];
  exportFileBase: string;
  /** Live unpaid invoices for the record-payment picker. */
  unpaidInvoices: UnpaidInvoiceOption[];
  /** For the New Invoice modal (real InvoiceForm). */
  customers: { id: string; name: string }[];
  taxConfig: TaxConfig;
  gstHstRegistered: boolean;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [liveActivity, setLiveActivity] = useState<MoneyActivityItem[]>(activity);
  const [liveStats, setLiveStats] = useState<MoneyStats>(stats);
  const [modalKind, setModalKind] = useState<'invoice' | 'income' | 'expense' | null>(null);
  const router = useRouter();
  // A save that just returned ok, whose record the server may not show
  // yet (a post-save refresh can return data that predates the write
  // when the deploy is cold or the DB is under connection pressure —
  // observed in QA runs 3 and 4: the expense was invisible on /money
  // for 90-180s after a save that returned ok, then appeared).
  const [pendingEntry, setPendingEntry] = useState<SavedEntry | null>(null);

  // Server truth replaces the live copy whenever the page re-renders
  // (after router.refresh() following a modal save). Adjusted during
  // render per the React "adjusting state when props change" pattern —
  // not in an effect — so a record is never shown twice. While a save
  // is pending, a refresh that predates it must NOT clobber the
  // optimistic copy: keep the live values until the server stats have
  // caught up with them, then accept server truth.
  const [prevActivity, setPrevActivity] = useState(activity);
  const [prevStats, setPrevStats] = useState(stats);
  if (prevActivity !== activity || prevStats !== stats) {
    setPrevActivity(activity);
    setPrevStats(stats);
    const serverCaughtUp =
      !pendingEntry ||
      (stats.incomeCents >= liveStats.incomeCents &&
        stats.expensesCents >= liveStats.expensesCents);
    if (serverCaughtUp) {
      if (pendingEntry) setPendingEntry(null);
      setLiveActivity(activity);
      setLiveStats(stats);
    }
  }

  const filtered = useMemo(
    () => filterMoneyActivity(liveActivity, filter),
    [liveActivity, filter]
  );

  const exportRows: ExportRow[] = useMemo(
    () =>
      filtered.map((a) => ({
        type: t(locale, `t10money.money.filter${a.kind === 'income' ? 'Income' : a.kind === 'expense' ? 'Expenses' : 'Invoices'}`),
        description: a.title,
        date: formatDateShort(a.date, localeMoneyTag(locale)),
        // Signed dollars: income +, expense -, invoice total +. The
        // export hook formats money-kind cells with formatMoney.
        amount: a.amountCents / 100,
        customer: a.party,
      })),
    [filtered, locale]
  );

  const { downloadCsv } = useExportDownloads({
    columns: exportColumns,
    rows: exportRows,
    fileBase: exportFileBase,
    currency,
    locale,
  });

  const onExport = () => {
    downloadCsv();
    toast.success(t(locale, 't10money.money.exported'));
  };

  /** A modal save landed: show the real record at once, then refresh. */
  const onEntrySaved = (entry: SavedEntry) => {
    const item: MoneyActivityItem = {
      id: `local-${Date.now()}`,
      kind: entry.kind,
      title: entry.title,
      detail: entry.detail,
      date: entry.date,
      amountCents: entry.kind === 'expense' ? -entry.amountCents : entry.amountCents,
      party: entry.party,
      href: entry.href,
    };
    setLiveActivity((list) => [item, ...list]);
    setLiveStats((s) => {
      if (entry.kind === 'income') {
        return {
          ...s,
          incomeCents: s.incomeCents + entry.amountCents,
          outstandingCents: Math.max(0, s.outstandingCents - entry.amountCents),
          netCents: s.netCents + entry.amountCents,
        };
      }
      return {
        ...s,
        expensesCents: s.expensesCents + entry.amountCents,
        netCents: s.netCents - entry.amountCents,
      };
    });
    setModalKind(null);
    setPendingEntry(entry);
    toast.success(
      t(
        locale,
        entry.kind === 'income'
          ? 't10money.paymentRecorded'
          : 'expenses.created'
      )
    );
    router.refresh();
  };

  const metrics = [
    {
      label: t(locale, 't10money.money.outstandingLabel'),
      desc: t(locale, 't10money.money.outstandingDesc'),
      value: liveStats.outstandingCents,
      icon: <Wallet size={17} aria-hidden="true" />,
      iconClass: '',
      negative: false,
    },
    {
      label: t(locale, 't10money.money.incomeLabel'),
      desc: t(locale, 't10money.money.incomeDesc'),
      value: liveStats.incomeCents,
      icon: <ArrowDown size={17} aria-hidden="true" />,
      iconClass: 'income-icon',
      negative: false,
    },
    {
      label: t(locale, 't10money.money.expensesLabel'),
      desc: t(locale, 't10money.money.expensesDesc'),
      value: liveStats.expensesCents,
      icon: <ArrowUp size={17} aria-hidden="true" />,
      iconClass: 'expense-icon',
      negative: false,
    },
    {
      label: t(locale, 't10money.money.netLabel'),
      desc: t(locale, 't10money.money.netDesc'),
      value: liveStats.netCents,
      icon: <TrendingUp size={17} aria-hidden="true" />,
      iconClass: 'net-icon',
      negative: liveStats.netCents < 0,
    },
  ];

  return (
    <div className="ej-money space-y-6">
      <header className="ej-money-header">
        <div className="min-w-0">
          <p className="ej-money-eyebrow">{t(locale, 't10money.money.eyebrow')}</p>
          <h1>{t(locale, 't10money.money.title')}</h1>
          <p className="ej-money-subtitle">{t(locale, 't10money.money.subtitle')}</p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={() => setModalKind('invoice')}
          className="ej-money-new-invoice"
        >
          <Plus size={16} aria-hidden="true" /> {t(locale, 't10money.money.newInvoice')}
        </Button>
      </header>

      <section className="ej-money-metrics" aria-label={t(locale, 't10money.money.title')}>
        {metrics.map((m) => (
          <article key={m.label} className="ej-money-metric-card">
            <div className="ej-money-metric-top">
              <span>{m.label}</span>
              <span className={cn('ej-money-metric-icon', m.iconClass)}>{m.icon}</span>
            </div>
            <strong className={cn(m.negative && 'ej-money-negative')}>
              {formatCents(m.value, currency, localeMoneyTag(locale))}
            </strong>
            <small>{m.desc}</small>
            <div className="ej-money-metric-track">
              <span style={{ width: m.value ? '42%' : '0%' }} />
            </div>
          </article>
        ))}
      </section>

      <section className="ej-money-activity-section">
        <div className="ej-money-section-heading">
          <div className="min-w-0">
            <p className="ej-money-eyebrow">{t(locale, 't10money.money.activityEyebrow')}</p>
            <h2>{t(locale, 't10money.money.activityTitle')}</h2>
            <p>{t(locale, 't10money.money.activityDesc')}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={onExport}
            disabled={filtered.length === 0}
            className="ej-money-export"
          >
            <Download size={15} aria-hidden="true" /> {t(locale, 't10money.money.exportActivity')}
          </Button>
        </div>

        <div className="ej-money-activity-toolbar">
          <div className="ej-money-filters" role="tablist" aria-label={t(locale, 't10money.money.activityTitle')}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn('ej-money-filter', filter === f.key && 'active')}
              >
                {t(locale, f.labelKey)}
              </button>
            ))}
          </div>
          <span className="ej-money-activity-count">
            {filtered.length === 1
              ? t(locale, 't10money.money.oneRecord')
              : t(locale, 't10money.money.manyRecords').replace(
                  '{count}',
                  String(filtered.length)
                )}
          </span>
        </div>

        {liveActivity.length === 0 ? (
          <div className="ej-money-empty-state">
            <div className="ej-money-empty-illustration" aria-hidden="true">
              <span className="ej-money-empty-orbit ej-money-orbit-one" />
              <span className="ej-money-empty-orbit ej-money-orbit-two" />
              <span className="ej-money-empty-wallet">
                <Wallet size={27} aria-hidden="true" />
              </span>
              <span className="ej-money-empty-spark ej-money-spark-a">
                <Sparkles size={15} aria-hidden="true" />
              </span>
              <span className="ej-money-empty-spark ej-money-spark-b">
                <DollarSign size={17} aria-hidden="true" />
              </span>
            </div>
            <h2>{t(locale, 't10money.money.emptyTitle')}</h2>
            <p>{t(locale, 't10money.money.emptyDesc')}</p>
            <Button type="button" variant="primary" onClick={() => setModalKind('invoice')}>
              <Plus size={16} aria-hidden="true" /> {t(locale, 't10money.money.newInvoice')}
            </Button>
            <div className="ej-money-empty-actions">
              <button type="button" onClick={() => setModalKind('income')}>
                <ArrowDown size={14} aria-hidden="true" /> {t(locale, 't10money.money.recordPayment')}
              </button>
              <span aria-hidden="true" />
              <button type="button" onClick={() => setModalKind('expense')}>
                <ArrowUp size={14} aria-hidden="true" /> {t(locale, 't10money.money.addExpense')}
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ej-money-no-matching">
            <p>{t(locale, 't10money.money.noMatching')}</p>
            <Button type="button" variant="secondary" onClick={() => setFilter('all')}>
              {t(locale, 't10money.money.clearFilter')}
            </Button>
          </div>
        ) : (
          <div className="ej-money-activity-list">
            {filtered.map((item) => (
              <Link key={item.id} href={item.href} className="ej-money-activity-row">
                <span className={cn('ej-money-activity-icon', `ej-money-activity-${item.kind}`)}>
                  {item.kind === 'income' ? (
                    <ArrowDown size={17} aria-hidden="true" />
                  ) : item.kind === 'expense' ? (
                    <ArrowUp size={17} aria-hidden="true" />
                  ) : (
                    <ReceiptText size={17} aria-hidden="true" />
                  )}
                </span>
                <span className="ej-money-activity-description">
                  <b>{item.title}</b>
                  <small>
                    {item.detail}, {formatDateShort(item.date, localeMoneyTag(locale))}
                  </small>
                </span>
                <strong
                  className={cn(
                    'ej-money-activity-amount',
                    item.kind === 'income' && 'positive',
                    item.kind === 'expense' && 'negative'
                  )}
                >
                  {item.kind === 'income'
                    ? '+'
                    : item.kind === 'expense'
                      ? '\u2212'
                      : ''}
                  {formatCents(Math.abs(item.amountCents), currency, localeMoneyTag(locale))}
                </strong>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="ej-money-quick-actions">
        <div>
          <span className="ej-money-eyebrow">{t(locale, 't10money.money.quickEyebrow')}</span>
          <b>{t(locale, 't10money.money.quickTitle')}</b>
        </div>
        <button type="button" onClick={() => setModalKind('income')}>
          <span className="ej-money-quick-action-icon">
            <ArrowDown size={17} aria-hidden="true" />
          </span>
          <span>
            <b>{t(locale, 't10money.money.recordPayment')}</b>
            <small>{t(locale, 't10money.money.recordPaymentDesc')}</small>
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setModalKind('expense')}>
          <span className="ej-money-quick-action-icon expense">
            <Briefcase size={17} aria-hidden="true" />
          </span>
          <span>
            <b>{t(locale, 't10money.money.addExpense')}</b>
            <small>{t(locale, 't10money.money.addExpenseDesc')}</small>
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </section>

      {modalKind === 'invoice' && (
        <NewInvoiceModal
          customers={customers}
          taxConfig={taxConfig}
          locale={locale}
          gstHstRegistered={gstHstRegistered}
          onClose={() => setModalKind(null)}
        />
      )}

      {(modalKind === 'income' || modalKind === 'expense') && (
        <MoneyEntryModal
          kind={modalKind}
          locale={locale}
          currency={currency}
          unpaidInvoices={unpaidInvoices}
          onClose={() => setModalKind(null)}
          onSaved={onEntrySaved}
        />
      )}
    </div>
  );
}
