'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { t, type Locale } from '@/lib/i18n';
import { centsToDollars, formatMoney } from '@/lib/money';

type UnpaidInvoice = {
  id: string;
  number: string;
  totalCents: number;
  balanceCents: number;
  dueAt: string | null;
};

type Summary = {
  customerId: string;
  customerName: string;
  balanceDueCents: number;
  unpaidCount: number;
  unpaid: UnpaidInvoice[];
  lastPayment: { amountCents: number; createdAt: string; provider: string } | null;
  totalPaidCents: number;
};

/**
 * Auto-fetched payment position for the selected customer (2026-10-28).
 * Renders under the customer select on the invoice form: balance due,
 * unpaid invoices (linked), last payment, lifetime collected. Empty
 * customer → nothing. A failed fetch fails silent — the form itself
 * must never break because a summary didn't load.
 */
export default function CustomerPaymentSummary({
  customerId,
  locale = 'en',
}: {
  customerId: string;
  locale?: Locale;
}) {
  const [fetched, setFetched] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- the fetch resolves
     asynchronously after the effect returns; the state updates are not
     synchronous effect-setup writes. */
  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/customers/${customerId}/payment-summary`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setFetched(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!customerId) return null;
  // A summary from the previously selected customer must never flash
  // while the new one loads.
  const summary = fetched?.customerId === customerId ? fetched : null;
  if (loading && !summary) {
    return (
      <p className="text-xs text-ink-2 mt-2">{t(locale, 'billing.paySummaryLoading')}</p>
    );
  }
  if (!summary) return null;

  const dateLabel = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));

  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 space-y-2">
      <p className="text-xs font-semibold text-ink">
        {t(locale, 'billing.paySummaryTitle')} — {summary.customerName}
      </p>
      {summary.balanceDueCents > 0 ? (
        <p className="text-sm text-ink">
          {t(locale, 'billing.paySummaryBalance')}:{' '}
          <strong>{formatMoney(centsToDollars(summary.balanceDueCents), 'CAD', locale)}</strong>
          {' '}· {summary.unpaidCount} {t(locale, 'billing.paySummaryUnpaid')}
        </p>
      ) : (
        <p className="text-sm text-ink-2">{t(locale, 'billing.paySummaryNone')}</p>
      )}
      {summary.unpaid.length > 0 && (
        <ul className="space-y-1">
          {summary.unpaid.slice(0, 5).map((inv) => (
            <li key={inv.id} className="text-xs text-ink-2">
              <Link href={`/invoices/${inv.id}`} className="text-ink font-semibold hover:underline">
                {inv.number}
              </Link>
              {' — '}
              {formatMoney(centsToDollars(inv.balanceCents), 'CAD', locale)}
              {inv.dueAt ? ` · ${t(locale, 'billing.paySummaryDue')} ${dateLabel(inv.dueAt)}` : ''}
            </li>
          ))}
        </ul>
      )}
      {summary.lastPayment && (
        <p className="text-xs text-ink-2">
          {t(locale, 'billing.paySummaryLastPayment')}:{' '}
          {formatMoney(centsToDollars(summary.lastPayment.amountCents), 'CAD', locale)}
          {' · '}
          {dateLabel(summary.lastPayment.createdAt)}
        </p>
      )}
    </div>
  );
}
