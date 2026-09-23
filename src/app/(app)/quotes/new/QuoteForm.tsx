'use client';

import React, { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { AlertCircle, FileCheck } from 'lucide-react';
import { toast } from 'sonner';
import { createQuote, type ActionResult } from '@/app/actions/quotes';
import LineItemsEditor from '@/components/LineItemsEditor';
import { Field, inputClass, primaryBtnClass, secondaryBtnClass, Card } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { calcTax, type TaxConfig } from '@/lib/tax';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';

/**
 * Fires a toast exactly once per server-action result. Minimal inline
 * replacement for the removed useActionToast helper.
 */
function useResultToast<T extends { ok?: boolean; error?: string }>(
  state: T | undefined,
  messages: { success?: string; error?: string }
) {
  const seen = useRef<T | undefined>(undefined);
  useEffect(() => {
    if (!state || seen.current === state) return;
    seen.current = state;
    if (state.ok && messages.success) {
      toast.success(messages.success);
    } else if (state.error) {
      toast.error(messages.error ?? state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

export default function QuoteForm({
  customers,
  taxConfig,
  locale = 'en',
}: {
  customers: { id: string; name: string }[];
  taxConfig: TaxConfig;
  locale?: Locale;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    createQuote,
    {}
  );
  const [subtotal, setSubtotal] = React.useState(0);

  // createQuote redirects to the new quote page on success; toast on failure only.
  useResultToast(state, {});

  // Client-side preview — the server recomputes the same numbers.
  const { taxAmount, breakdown } = calcTax(subtotal, taxConfig);
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <Card className="p-6 space-y-4">
        <Field label="Title">
          <input
            name="title"
            required
            maxLength={200}
            placeholder="e.g. Full house wiring repair"
            className={inputClass}
          />
        </Field>
        <Field label="Customer">
          <select name="customerId" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Select a customer
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {customers.length === 0 && (
            <p className="text-[11px] text-zinc-400 mt-1">
              No customers yet —{' '}
              <Link href="/customers/new" className="text-ink font-semibold hover:underline">
                add one first
              </Link>
              .
            </p>
          )}
        </Field>
      </Card>

      <Card className="p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-3">Line items</h2>
        <LineItemsEditor onSubtotal={setSubtotal} currency={taxConfig.currency} locale={locale} />
      </Card>

      <Card className="p-6">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-zinc-600">
            <dt>{t(locale, 't10money.subtotalLabel')}</dt>
            <dd className="font-semibold">{formatMoney(subtotal, taxConfig.currency)}</dd>
          </div>
          {breakdown.map((b) => (
            <div key={b.name} className="flex justify-between text-zinc-600">
              <dt>
                {b.name} {b.rate}%
              </dt>
              <dd className="font-semibold">{formatMoney(b.amount, taxConfig.currency)}</dd>
            </div>
          ))}
          <div className="flex justify-between items-center border-t border-zinc-100 pt-3 mt-1">
            <dt className="text-zinc-600">{t(locale, 't10money.quoteTotalLabel')}</dt>
            <dd className="text-2xl font-bold text-zinc-900">
              {formatMoney(total, taxConfig.currency)}
            </dd>
          </div>
        </dl>
        <p className="text-[11px] text-zinc-400 mt-3">
          {taxConfig.label} included — set in Settings → Region & tax.
        </p>
      </Card>

      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={primaryBtnClass}>
          <FileCheck size={14} />
          {isPending ? t(locale, 't10money.quoteCreating') : t(locale, 't10money.quoteCreate')}
        </button>
        <Link href="/quotes" className={secondaryBtnClass}>
          {t(locale, 't10money.formCancel')}
        </Link>
      </div>
    </form>
  );
}
