'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, FileCheck } from '@/components/icons';
import { toast } from 'sonner';
import { createQuote, type ActionResult } from '@/app/actions/quotes';
import LineItemsEditor from '@/components/LineItemsEditor';
import MorphSelect from '@/components/MorphSelect';
import { Button, Card, DateField, Input, Select } from '@/components/kit';
import { TaxSelect, defaultTaxSelection, type TaxSelection } from '../../_components/TaxSelect';
import { formatMoney } from '@/lib/money';
import { calcTax, splitStoredTax, type TaxConfig } from '@/lib/tax';
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
  templates = [],
  locale = 'en',
}: {
  customers: { id: string; name: string }[];
  taxConfig: TaxConfig;
  /** Slice 4: templates for the "start from template" picker. */
  templates?: {
    id: string;
    name: string;
    items: { desc: string; qty: string; rate: string; cost: string }[];
  }[];
  locale?: Locale;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    createQuote,
    {}
  );
  const [subtotal, setSubtotal] = useState(0);
  const [customerId, setCustomerId] = useState('');
  // Slice 4: title is CONTROLLED so picking a template can fill it, and
  // so a failed save (useActionState resets the form element) never
  // wipes it — the JobForm form-reset lesson.
  const [title, setTitle] = useState('');
  // Slice 5: same treatment for the validity date.
  const [validUntil, setValidUntil] = useState('');
  const [appliedId, setAppliedId] = useState('');
  const applied = templates.find((tpl) => tpl.id === appliedId) ?? null;
  const [taxSel, setTaxSel] = useState<TaxSelection>(() =>
    defaultTaxSelection(taxConfig)
  );

  // createQuote redirects to the new quote page on success; toast on failure only.
  useResultToast(state, {});

  // Client-side preview - the server recomputes the same numbers through
  // splitStoredTax on the submitted taxType + taxRate, so the previewed
  // total is the stored total.
  const { taxAmount, breakdown } = calcTax(subtotal, {
    taxes: splitStoredTax(taxSel.taxType, taxSel.taxRate),
  });
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <input type="hidden" name="taxType" value={taxSel.taxType} />
      <input type="hidden" name="taxRate" value={taxSel.taxRate} />

      <Card className="p-6 space-y-4">
        <Input
          label="Title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          placeholder="e.g. Full house wiring repair"
        />
        <div>
          <MorphSelect
            id="quote-customer"
            label="Customer"
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
            value={customerId}
            onChange={setCustomerId}
          />
          <input type="hidden" name="customerId" value={customerId} required />
          {customers.length === 0 && (
            <p className="text-[11px] text-ink-2 mt-1">
              No customers yet -{' '}
              <Link href="/customers/new" className="text-ink font-semibold hover:underline">
                add one first
              </Link>
              .
            </p>
          )}
        </div>
        <DateField
          label={t(locale, 'quotes.expiry.validUntil')}
          name="validUntil"
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
          hint={t(locale, 'quotes.expiry.validUntilHint')}
        />
      </Card>

      <Card className="p-6">
        <h2 className="text-sm font-bold text-ink mb-3">Line items</h2>
        {templates.length > 0 && (
          <div className="mb-4">
            <Select
              label={t(locale, 'quotes.templates.useTemplate')}
              options={[
                { value: '', label: t(locale, 'quotes.templates.blankOption') },
                ...templates.map((tpl) => ({ value: tpl.id, label: tpl.name })),
              ]}
              value={appliedId}
              onChange={(e) => {
                const id = e.target.value;
                setAppliedId(id);
                // Applying a template COPIES its lines and fills the
                // title; picking Blank clears lines only, never a title
                // the pro already typed.
                const tpl = templates.find((x) => x.id === id);
                if (tpl) setTitle(tpl.name);
              }}
            />
          </div>
        )}
        {/* Remount on template change: the editor owns its rows in state,
            so a new key is what swaps blank rows for template lines. */}
        <LineItemsEditor
          key={applied?.id ?? 'blank'}
          initialItems={applied?.items}
          onSubtotal={setSubtotal}
          currency={taxConfig.currency}
          locale={locale}
        />
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-bold text-ink">
          {t(locale, 't10money.taxSelectLabel')}
        </h2>
        <div className="min-w-0">
          <TaxSelect
            locale={locale}
            label={t(locale, 't10money.taxSelectLabel')}
            value={taxSel}
            onChange={setTaxSel}
          />
        </div>
        <dl className="space-y-1.5 text-sm border-t border-line pt-4">
          <div className="flex justify-between text-ink-2">
            <dt>{t(locale, 't10money.subtotalLabel')}</dt>
            <dd className="font-semibold">{formatMoney(subtotal, taxConfig.currency)}</dd>
          </div>
          {breakdown.map((b) => (
            <div key={b.name} className="flex justify-between text-ink-2">
              <dt>
                {b.name} {b.rate}%
              </dt>
              <dd className="font-semibold">{formatMoney(b.amount, taxConfig.currency)}</dd>
            </div>
          ))}
          <div className="flex justify-between items-center border-t border-line pt-3 mt-1">
            <dt className="text-ink-2">{t(locale, 't10money.quoteTotalLabel')}</dt>
            <dd className="text-2xl font-bold text-ink">
              {formatMoney(total, taxConfig.currency)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-6">
        <Input
          label={t(locale, 't10money.depositRequestLabel')}
          hint={t(locale, 't10money.depositRequestHint')}
          name="depositAmount"
          type="text"
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          placeholder={t(locale, 't10money.depositRequestPh')}
        />
      </Card>

      {state?.error && (
        <div className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={isPending}>
          <FileCheck size={14} />
          {isPending ? t(locale, 't10money.quoteCreating') : t(locale, 't10money.quoteCreate')}
        </Button>
        <Button variant="secondary" href="/quotes">
          {t(locale, 't10money.formCancel')}
        </Button>
      </div>
    </form>
  );
}
