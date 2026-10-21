'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Receipt } from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { createInvoice, type ActionResult } from '@/app/actions/invoices';
import LineItemsEditor from '@/components/LineItemsEditor';
import {
  Button,
  Card,
  DateField,
  Select,
  Textarea,
} from '@/components/kit';
import { TaxSelect, defaultTaxSelection, type TaxSelection } from '../../_components/TaxSelect';
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
import { calcTax, splitStoredTax, type TaxConfig } from '@/lib/tax';

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function InvoiceForm({
  customers,
  taxConfig,
  locale = 'en',
  jobContext = null,
}: {
  customers: { id: string; name: string }[];
  taxConfig: TaxConfig;
  locale?: Locale;
  /** D4: set when the form was opened from a job's "Create invoice"
   *  button — prefills the customer + first line item and links the
   *  created invoice back to the job (hidden jobId field). */
  jobContext?: {
    jobId: string;
    jobTitle: string;
    customerId: string;
    price: number;
  } | null;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    createInvoice,
    {}
  );

  // createInvoice redirects to the new invoice on success; toast on failure only.
  useResultToast(state, {});
  const [subtotal, setSubtotal] = useState(0);
  const [taxSel, setTaxSel] = useState<TaxSelection>(() =>
    defaultTaxSelection(taxConfig)
  );

  // Breakdown preview through the shared tax engine - createInvoice
  // recomputes with the exact same call (splitStoredTax on the submitted
  // taxType + taxRate), so the previewed total is always the stored total.
  // (Quebec QST is 9.975% on the price before GST - Revenu Québec changed
  // this from GST-inclusive on 2013-01-01.)
  const { taxAmount, breakdown: lines } = calcTax(subtotal, {
    taxes: splitStoredTax(taxSel.taxType, taxSel.taxRate),
  });
  const total = round2(subtotal + taxAmount);

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <input type="hidden" name="taxType" value={taxSel.taxType} />
      <input type="hidden" name="taxRate" value={taxSel.taxRate} />
      {jobContext && (
        <input type="hidden" name="jobId" value={jobContext.jobId} />
      )}

      {jobContext && (
        <p className="text-sm text-ink-2 bg-surface-2 border border-line rounded-xl px-4 py-3">
          Invoice for job <strong className="text-ink">{jobContext.jobTitle}</strong> —
          the customer and first line item are filled in from the job, and
          the invoice will be linked to it. Edit anything before creating.
        </p>
      )}

      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <Select
              label="Customer"
              name="customerId"
              required
              defaultValue={jobContext?.customerId ?? ''}
              options={[
                { value: '', label: 'Select a customer', disabled: true },
                ...customers.map((c) => ({ value: c.id, label: c.name })),
              ]}
              hint={
                customers.length === 0 ? (
                  <span>
                    No customers yet -{' '}
                    <Link
                      href="/customers/new"
                      className="text-ink font-semibold hover:underline"
                    >
                      add one first
                    </Link>
                    .
                  </span>
                ) : undefined
              }
            />
          </div>
          <div className="min-w-0">
            <DateField
              label="Invoice date"
              name="date"
              required
              defaultValue={toISODateLocal(new Date())}
            />
          </div>
        </div>
        <Textarea
          label="Notes (optional)"
          hint="Shown on the invoice."
          name="notes"
          rows={2}
          maxLength={2000}
          placeholder="e.g. Payment due within 7 days"
        />
      </Card>

      <Card className="p-6">
        <h2 className="text-sm font-bold text-ink mb-3">Line items</h2>
        <LineItemsEditor
          onSubtotal={setSubtotal}
          currency={taxConfig.currency}
          locale={locale}
          initialItems={
            jobContext
              ? [
                  {
                    desc: jobContext.jobTitle,
                    qty: '1',
                    rate: String(jobContext.price),
                  },
                ]
              : undefined
          }
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

        <dl className="border-t border-line pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-ink-2">
            <dt>{t(locale, 't10money.subtotalLabel')}</dt>
            <dd className="font-semibold">{formatMoney(subtotal, taxConfig.currency)}</dd>
          </div>
          {lines.map((l) => (
            <div key={l.name} className="flex justify-between text-ink-2">
              <dt>
                {l.name} {l.rate}%
              </dt>
              <dd className="font-semibold">{formatMoney(l.amount, taxConfig.currency)}</dd>
            </div>
          ))}
          <div className="flex justify-between text-base pt-1">
            <dt className="font-bold text-ink">{t(locale, 't10money.totalLabel')}</dt>
            <dd className="font-bold text-ink">{formatMoney(total, taxConfig.currency)}</dd>
          </div>
        </dl>
      </Card>

      {state?.error && (
        <div className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={isPending}>
          <Receipt size={14} />
          {isPending ? t(locale, 't10money.invCreating') : t(locale, 't10money.invCreate')}
        </Button>
        <Button variant="secondary" href="/invoices">
          {t(locale, 't10money.formCancel')}
        </Button>
      </div>
    </form>
  );
}
