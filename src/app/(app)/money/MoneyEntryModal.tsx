'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, UserRound, CalendarDays, DollarSign, FileText } from '@/components/icons';
import { t, type Locale } from '@/lib/i18n';
import { formatCents } from '@/lib/money';
import { localeMoneyTag } from '@/lib/utils';
import { recordPayment } from '@/app/actions/invoices';
import { createExpense, type ExpenseResult } from '@/app/actions/expenses';
import { EXPENSE_CATEGORIES } from '@/lib/expenses';
import type { UnpaidInvoiceOption } from './MoneyClient';

export type SavedEntry = {
  kind: 'income' | 'expense';
  /** Positive magnitude in cents. */
  amountCents: number;
  title: string;
  detail: string;
  party: string;
  /** ISO date string for the activity row. */
  date: string;
  href: string;
};

const PROVIDERS = ['CASH', 'INTERAC', 'CHEQUE', 'STRIPE', 'OTHER'] as const;

/** Local YYYY-MM-DD for the date input default (today). */
function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Money entry modal (ChatGPT Money prototype's MoneyEntryModal, wired to
 * the real server actions).
 *
 * - Record a payment: picks a live unpaid invoice and calls the real
 *   recordPayment — the payment attaches to that invoice, the invoice
 *   status derives from the money, and the payment is stamped today
 *   (the action takes no date). The amount defaults to the invoice's
 *   remaining balance and cannot exceed it client-side; the server
 *   guards overpayment in its transaction.
 * - Add an expense: calls the real createExpense. The prototype's
 *   vendor / payee field has no JobExpense column, so it is stored in
 *   the expense note (alone, or ahead of the notes, comma-separated).
 *
 * The invoice kind is NOT here: a real invoice needs a customer, line
 * items and tax, so New invoice opens NewInvoiceModal instead.
 */
export default function MoneyEntryModal({
  kind,
  locale,
  currency,
  unpaidInvoices,
  onClose,
  onSaved,
}: {
  kind: 'income' | 'expense';
  locale: Locale;
  currency?: string | null;
  unpaidInvoices: UnpaidInvoiceOption[];
  onClose: () => void;
  onSaved: (entry: SavedEntry) => void;
}) {
  const [invoiceId, setInvoiceId] = useState(unpaidInvoices[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>('CASH');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<(typeof EXPENSE_CATEGORIES)[number]>('MATERIALS');
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState(todayLocal);
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape closes; body scroll locks while the modal is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const selectedInvoice = useMemo(
    () => unpaidInvoices.find((i) => i.id === invoiceId) ?? null,
    [unpaidInvoices, invoiceId]
  );

  // Picking an invoice pre-fills its remaining balance.
  const onInvoiceChange = (id: string) => {
    setInvoiceId(id);
    const inv = unpaidInvoices.find((i) => i.id === id);
    setAmount(inv ? (inv.remainingCents / 100).toFixed(2) : '');
    setError(null);
  };

  const providerLabel = (p: string): string => {
    if (p === 'CASH') return t(locale, 't10money.money.providerCash');
    if (p === 'CHEQUE') return t(locale, 't10money.money.providerCheque');
    if (p === 'OTHER') return t(locale, 't10money.money.providerOther');
    if (p === 'STRIPE') return t(locale, 't10money.money.providerCard');
    return t(locale, 't10money.money.providerInterac');
  };

  const submitIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || pending) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setPending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set('invoiceId', selectedInvoice.id);
      fd.set('amount', value.toFixed(2));
      fd.set('provider', provider);
      const result = await recordPayment({}, fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onSaved({
        kind: 'income',
        amountCents: Math.round(value * 100),
        title: `${selectedInvoice.number}, ${selectedInvoice.customerName}`,
        detail: providerLabel(provider),
        party: selectedInvoice.customerName,
        date: new Date().toISOString(),
        href: `/invoices/${selectedInvoice.id}`,
      });
    } finally {
      setPending(false);
    }
  };

  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const value = Number(amount);
    if (!description.trim() || !Number.isFinite(value) || value <= 0) return;
    setPending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set('description', description.trim());
      fd.set('amount', value.toFixed(2));
      fd.set('category', category);
      fd.set('spentAt', date);
      // Vendor has no column: it rides in the note.
      const note = vendor.trim()
        ? notes.trim()
          ? `${vendor.trim()}, ${notes.trim()}`
          : vendor.trim()
        : notes.trim();
      fd.set('note', note);
      const result: ExpenseResult = await createExpense(fd);
      if (!result.ok) {
        if (result.error === 'validation' && result.errorKey) {
          setError(t(locale, result.errorKey as never));
        } else {
          const map: Record<string, string> = {
            rateLimited: 'errors.tooManyRequests',
            notFound: 'errors.notFound',
            jobNotFound: 'errors.notFound',
          };
          setError(t(locale, (map[result.error ?? ''] ?? 'errors.uploadFailed') as never));
        }
        return;
      }
      onSaved({
        kind: 'expense',
        amountCents: Math.round(value * 100),
        title: description.trim(),
        detail: t(locale, `expenses.categories.${category}`),
        party: note,
        date: new Date(`${date}T12:00:00`).toISOString(),
        href: '/expenses',
      });
    } finally {
      setPending(false);
    }
  };

  const isIncome = kind === 'income';
  const title = t(locale, isIncome ? 't10money.money.incomeTitle' : 't10money.money.expenseTitle');

  return (
    <div
      className="ej-money-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="ej-money-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ej-money-entry-title"
      >
        <header className="ej-money-modal-heading">
          <div>
            <span className="ej-money-modal-kicker">
              {t(locale, isIncome ? 't10money.money.incomeKicker' : 't10money.money.expenseKicker')}
            </span>
            <h2 id="ej-money-entry-title">{title}</h2>
            <p>
              {t(locale, isIncome ? 't10money.money.incomeModalDesc' : 't10money.money.expenseDesc')}
            </p>
          </div>
          <button
            type="button"
            className="ej-money-modal-close"
            onClick={onClose}
            aria-label={t(locale, 'common.close')}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        {isIncome ? (
          <form onSubmit={submitIncome}>
            {unpaidInvoices.length === 0 ? (
              <p className="ej-money-modal-note">
                {t(locale, 't10money.money.noUnpaidInvoices')}
              </p>
            ) : (
              <>
                <label>
                  <span>
                    <FileText size={14} aria-hidden="true" />
                    {t(locale, 't10money.money.invoiceLabel')}
                  </span>
                  <select
                    value={invoiceId}
                    onChange={(e) => onInvoiceChange(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      {t(locale, 't10money.money.invoicePlaceholder')}
                    </option>
                    {unpaidInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.number}, {inv.customerName}, {' '}
                        {t(locale, 't10money.money.invoiceRemaining').replace(
                          '{amount}',
                          formatCents(inv.remainingCents, currency, localeMoneyTag(locale))
                        )}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="ej-money-modal-grid">
                  <label>
                    <span>
                      <DollarSign size={14} aria-hidden="true" />
                      {t(locale, 'expenses.amount')}
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={
                        selectedInvoice
                          ? (selectedInvoice.remainingCents / 100).toFixed(2)
                          : undefined
                      }
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </label>
                  <label>
                    <span>
                      <UserRound size={14} aria-hidden="true" />
                      {t(locale, 't10money.money.providerLabel')}
                    </span>
                    <select
                      value={provider}
                      onChange={(e) =>
                        setProvider(e.target.value as (typeof PROVIDERS)[number])
                      }
                    >
                      {PROVIDERS.map((p) => (
                        <option key={p} value={p}>
                          {providerLabel(p)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            )}
            {error && (
              <p className="ej-money-modal-error" role="alert">
                {error}
              </p>
            )}
            <footer className="ej-money-modal-actions">
              <button type="button" className="ej-money-button-quiet" onClick={onClose}>
                {t(locale, 'common.cancel')}
              </button>
              <button
                type="submit"
                className="ej-money-button-primary"
                disabled={pending || !selectedInvoice}
              >
                {pending
                  ? t(locale, 'common.saving')
                  : t(locale, 't10money.money.recordButton')}
              </button>
            </footer>
          </form>
        ) : (
          <form onSubmit={submitExpense}>
            <label>
              <span>
                <FileText size={14} aria-hidden="true" />
                {t(locale, 'expenses.description')}
              </span>
              <input
                autoFocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t(locale, 'expenses.descriptionPlaceholder')}
                required
              />
            </label>
            <label>
              <span>
                <UserRound size={14} aria-hidden="true" />
                {t(locale, 't10money.money.vendorLabel')}
              </span>
              <input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder={t(locale, 't10money.money.vendorPlaceholder')}
              />
            </label>
            <div className="ej-money-modal-grid">
              <label>
                <span>
                  <CalendarDays size={14} aria-hidden="true" />
                  {t(locale, 'expenses.date')}
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </label>
              <label>
                <span>
                  <DollarSign size={14} aria-hidden="true" />
                  {t(locale, 'expenses.amount')}
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </label>
            </div>
            <label>
              <span>
                <FileText size={14} aria-hidden="true" />
                {t(locale, 'expenses.category')}
              </span>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as (typeof EXPENSE_CATEGORIES)[number])
                }
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(locale, `expenses.categories.${c}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>
                <FileText size={14} aria-hidden="true" />
                {t(locale, 't10money.money.notesLabel')}
              </span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t(locale, 't10money.money.notesPlaceholder')}
              />
            </label>
            {error && (
              <p className="ej-money-modal-error" role="alert">
                {error}
              </p>
            )}
            <footer className="ej-money-modal-actions">
              <button type="button" className="ej-money-button-quiet" onClick={onClose}>
                {t(locale, 'common.cancel')}
              </button>
              <button type="submit" className="ej-money-button-primary" disabled={pending}>
                {pending ? t(locale, 'common.saving') : t(locale, 'expenses.save')}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
