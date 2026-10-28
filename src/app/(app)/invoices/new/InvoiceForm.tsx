'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Receipt } from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { createInvoice, type ActionResult } from '@/app/actions/invoices';
import LineItemsEditor from '@/components/LineItemsEditor';
import CustomerPaymentSummary from '@/components/CustomerPaymentSummary';
import {
  Button,
  Card,
  DateField,
  Select,
  Textarea,
} from '@/components/kit';
import { TaxSelect, defaultTaxSelection, type TaxSelection } from '../../_components/TaxSelect';
import { taxSelections } from '@/lib/tax-select';
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
    /** Slice 2: the job's service property, when linked. */
    property: { id: string; label: string; province: string | null } | null;
  } | null;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    createInvoice,
    {}
  );

  // createInvoice redirects to the new invoice on success; toast on failure only.
  useResultToast(state, {});
  const [subtotal, setSubtotal] = useState(0);
  // Selected customer drives the auto-fetched payment summary below the
  // select (2026-10-28): balance due, unpaid invoices, last payment.
  const [customerId, setCustomerId] = useState<string>(jobContext?.customerId ?? '');
  const [taxSel, setTaxSel] = useState<TaxSelection>(() =>
    defaultTaxSelection(taxConfig)
  );

  // Slice 2: the manual form gains the job form's optional property picker
  // (same tenant-scoped /api/customers/options source). Picking a property
  // sets the tax DEFAULT to that property's province — it never locks the
  // TaxSelect, which stays freely overridable. The picker submits nothing:
  // Invoice has no property link; the chosen taxType/taxRate carry the
  // effect, and the issued invoice keeps its tax snapshot afterwards.
  type FormProperty = { id: string; customerId: string; label: string; address: string; province: string | null };
  const [liveProperties, setLiveProperties] = useState<FormProperty[]>([]);
  const [propertyValue, setPropertyValue] = useState<string>(jobContext?.property?.id ?? '');
  // True while the current tax selection came from a property pick (or the
  // arriving job's property) rather than a manual TaxSelect change — the
  // hint below only claims a property basis while this holds.
  const [taxFromProperty, setTaxFromProperty] = useState<boolean>(
    !!jobContext?.property?.province
  );
  useEffect(() => {
    let cancelled = false;
    fetch('/api/customers/options', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.properties)) {
          setLiveProperties(data.properties);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  // Switching customers resets the property link (a property belongs to
  // exactly one customer) — except when switching back to the arriving
  // job's customer, which restores the job's property and its tax default
  // (the same default the form opened with).
  const onCustomerChange = (value: string) => {
    setCustomerId(value);
    if (value === jobContext?.customerId && jobContext?.property) {
      setPropertyValue(jobContext.property.id);
      const province = jobContext.property.province;
      if (province) {
        const sel = taxSelections(locale).find((s) => s.id === province.toUpperCase());
        if (sel) setTaxSel(sel);
        setTaxFromProperty(true);
      } else {
        setTaxFromProperty(false);
      }
    } else {
      setPropertyValue('');
      setTaxFromProperty(false);
    }
  };
  const effectiveProperties = liveProperties.filter((p) => p.customerId === customerId);
  const onPropertyChange = (value: string) => {
    setPropertyValue(value);
    if (!value) {
      setTaxFromProperty(false);
      return;
    }
    const prop = effectiveProperties.find((p) => p.id === value);
    if (prop?.province) {
      const sel = taxSelections(locale).find((s) => s.id === prop.province!.toUpperCase());
      if (sel) {
        setTaxSel(sel);
        setTaxFromProperty(true);
      }
    }
  };
  // The property driving the hint: the live pick when available, else the
  // arriving job's property before the options refresh lands.
  const selectedProperty =
    effectiveProperties.find((p) => p.id === propertyValue) ??
    (jobContext?.property?.id === propertyValue ? jobContext.property : undefined);
  const hintProvince = taxFromProperty ? (selectedProperty?.province ?? null) : null;

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
              value={customerId}
              onChange={(e) => onCustomerChange(e.target.value)}
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
            <CustomerPaymentSummary customerId={customerId} locale={locale} />
            {customerId !== '' && effectiveProperties.length > 0 && (
              <div className="mt-4">
                <Select
                  label={t(locale, 'jobs.serviceProperty')}
                  value={propertyValue}
                  onChange={(e) => onPropertyChange(e.target.value)}
                  options={[
                    { value: '', label: t(locale, 'jobs.noSpecificProperty') },
                    ...effectiveProperties.map((p) => ({
                      value: p.id,
                      label: `${p.label} — ${p.address}${p.province ? ` (${p.province})` : ''}`,
                    })),
                  ]}
                  hint={t(locale, 'billing.taxPropertyPickerHint')}
                />
              </div>
            )}
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
            onChange={(sel) => {
              setTaxSel(sel);
              setTaxFromProperty(false);
            }}
          />
          {hintProvince && (
            <p className="text-xs text-ink-2">
              {t(locale, 'billing.taxPropertyHint').replace('{province}', hintProvince)}
            </p>
          )}
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
