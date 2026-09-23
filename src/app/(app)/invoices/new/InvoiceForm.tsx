'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { createInvoice, type ActionResult } from '@/app/actions/invoices';
import LineItemsEditor from '@/components/LineItemsEditor';
import { Field, FormGrid, inputClass, primaryBtnClass, secondaryBtnClass, Card } from '@/components/ui';
import { toISODateLocal } from '@/lib/utils';

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
import { formatMoney } from '@/lib/money';
import {
  defaultTaxType,
  splitStoredTax,
  totalTaxRate,
  type TaxConfig,
} from '@/lib/tax';

const round2 = (n: number) => Math.round(n * 100) / 100;

function taxTypeOptions(config: TaxConfig): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  if (config.taxes.length > 1) {
    const composite = `${config.taxes[0].name}+${config.taxes[1].name}`;
    options.push({
      value: composite,
      label: config.taxes.map((t) => `${t.name} ${t.rate}%`).join(' + '),
    });
  }
  for (const t of config.taxes) {
    options.push({ value: t.name, label: `${t.name} ${t.rate}%` });
  }
  return options;
}

export default function InvoiceForm({
  customers,
  taxConfig,
  locale = 'en',
}: {
  customers: { id: string; name: string }[];
  taxConfig: TaxConfig;
  locale?: Locale;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    createInvoice,
    {}
  );

  // createInvoice redirects to the new invoice on success; toast on failure only.
  useResultToast(state, {});
  const [subtotal, setSubtotal] = useState(0);
  const [taxRate, setTaxRate] = useState(totalTaxRate(taxConfig));
  const [taxType, setTaxType] = useState<string>(defaultTaxType(taxConfig));

  const options = taxTypeOptions(taxConfig);
  // Breakdown preview from the stored-style tax (server recomputes anyway).
  const lines = splitStoredTax(taxType, taxRate).map((l) => ({
    ...l,
    amount: round2((subtotal * l.rate) / 100),
  }));
  const taxAmount = round2(lines.reduce((s, l) => s + l.amount, 0));
  const total = round2(subtotal + taxAmount);

  const quickRates = [0, totalTaxRate(taxConfig)];

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <Card className="p-6 space-y-4">
        <FormGrid>
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
          <Field label="Invoice date">
            <input
              name="date"
              type="date"
              required
              defaultValue={toISODateLocal(new Date())}
              className={inputClass}
            />
          </Field>
        </FormGrid>
        <Field label="Notes (optional)" hint="Shown on the invoice.">
          <textarea
            name="notes"
            rows={2}
            maxLength={2000}
            placeholder="e.g. Payment due within 7 days"
            className={inputClass}
          />
        </Field>
      </Card>

      <Card className="p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-3">Line items</h2>
        <LineItemsEditor onSubtotal={setSubtotal} currency={taxConfig.currency} locale={locale} />
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-bold text-zinc-900">Tax</h2>
        <FormGrid>
          <Field label="Tax type">
            <select
              name="taxType"
              value={taxType}
              onChange={(e) => setTaxType(e.target.value)}
              className={inputClass}
            >
              {options.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tax rate %">
            <div className="flex gap-2">
              <input
                name="taxRate"
                type="number"
                min={0}
                max={100}
                step="0.001"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {quickRates.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTaxRate(r)}
                  className={`min-h-[44px] px-3.5 rounded-lg text-[11px] font-bold border transition-colors ${
                    taxRate === r
                      ? 'bg-ink text-white border-ink'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  {r}%
                </button>
              ))}
            </div>
          </Field>
        </FormGrid>

        <dl className="border-t border-zinc-100 pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-zinc-600">
            <dt>{t(locale, 't10money.subtotalLabel')}</dt>
            <dd className="font-semibold">{formatMoney(subtotal, taxConfig.currency)}</dd>
          </div>
          {lines.map((l) => (
            <div key={l.name} className="flex justify-between text-zinc-600">
              <dt>
                {l.name} {l.rate}%
              </dt>
              <dd className="font-semibold">{formatMoney(l.amount, taxConfig.currency)}</dd>
            </div>
          ))}
          <div className="flex justify-between text-base pt-1">
            <dt className="font-bold text-zinc-900">{t(locale, 't10money.totalLabel')}</dt>
            <dd className="font-bold text-zinc-900">{formatMoney(total, taxConfig.currency)}</dd>
          </div>
        </dl>
      </Card>

      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={primaryBtnClass}>
          <Receipt size={14} />
          {isPending ? t(locale, 't10money.invCreating') : t(locale, 't10money.invCreate')}
        </button>
        <Link href="/invoices" className={secondaryBtnClass}>
          {t(locale, 't10money.formCancel')}
        </Link>
      </div>
    </form>
  );
}
