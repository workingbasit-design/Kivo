'use client';

import React, { useActionState, useEffect, useState } from 'react';
import { AlertCircle, CloudOff, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { toISODateLocal } from '@/lib/utils';
import { currencySymbol } from '@/lib/money';
import { t, type Locale } from '@/lib/i18n';
import type { JobActionResult } from '@/app/actions/jobs';

export interface JobFormCustomer {
  id: string;
  name: string;
}

export interface JobFormInitial {
  id?: string;
  title?: string;
  customerId?: string;
  date?: string; // YYYY-MM-DD
  time?: string | null;
  address?: string | null;
  price?: number;
  notes?: string | null;
  technician?: string | null;
  /** Price-book service this job was created from (create flow only). */
  serviceId?: string;
  /** Checklist template this job was created from (create flow only). */
  templateId?: string;
}

/** Resolve the app locale in a client component: an explicit prop wins,
 *  otherwise the `kivo-locale` cookie (LanguageToggle writes it). */
function resolveLocale(prop?: Locale): Locale {
  if (prop) return prop;
  if (typeof document !== 'undefined') {
    const m = document.cookie.match(/(?:^|;\s*)kivo-locale=(en|fr)/);
    if (m) return m[1] as Locale;
  }
  return 'en';
}

/**
 * Shared create/edit job form. Quick-create stays minimal so a job
 * can be captured in under 20 seconds, even for a brand-new customer.
 */
export default function JobForm({
  customers,
  initial,
  action,
  submitLabel,
  locale: localeProp,
  currency,
}: {
  customers: JobFormCustomer[];
  initial?: JobFormInitial;
  action: (_prev: JobActionResult, formData: FormData) => Promise<JobActionResult>;
  submitLabel: string;
  /** Optional — falls back to the `kivo-locale` cookie so pages that don't
   *  pass it (e.g. /jobs/new) still render in the user's language. */
  locale?: Locale;
  /** Business currency code — drives the price label (e.g. CAD). */
  currency?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  const [locale] = useState<Locale>(() => resolveLocale(localeProp));
  const T = (k: string) => t(locale, `t10work.${k}`);
  const jobsL = (k: string) => t(locale, `jobs.${k}`);
  // Freshness: the SSR `customers` prop can be stale (client-side navigation
  // reuses cached RSC). Refresh on mount so a customer created moments ago
  // always appears in the combobox.
  const [liveCustomers, setLiveCustomers] = useState<JobFormCustomer[]>(customers);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/customers/options', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.customers)) {
          setLiveCustomers(data.customers);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);
  const [customerChoice, setCustomerChoice] = useState<string>(
    initial?.customerId ?? (customers[0]?.id ?? '__NEW__')
  );
  const showNewCustomer = customerChoice === '__NEW__';

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      {initial?.serviceId && <input type="hidden" name="serviceId" value={initial.serviceId} />}
      {initial?.templateId && <input type="hidden" name="templateId" value={initial.templateId} />}

      <Field label={T('formTitleLabel')}>
        <input
          name="title"
          required
          autoFocus
          defaultValue={initial?.title ?? ''}
          placeholder={T('formTitlePlaceholder')}
          maxLength={200}
          className={inputClass}
        />
      </Field>

      <Field label={jobsL('customer')}>
        <select
          name="customerId"
          value={customerChoice}
          onChange={(e) => setCustomerChoice(e.target.value)}
          className={inputClass}
        >
          {liveCustomers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="__NEW__">{T('formNewCustomerOption')}</option>
        </select>
      </Field>

      {showNewCustomer && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-paper border border-smoke rounded-2xl">
          <Field label={T('formNewCustomerName')}>
            <input
              name="newCustomerName"
              placeholder={T('formNewCustomerNamePlaceholder')}
              maxLength={120}
              className={inputClass}
            />
          </Field>
          <Field label={T('formNewCustomerPhone')}>
            <input
              name="newCustomerPhone"
              placeholder={T('formPhonePlaceholder')}
              maxLength={25}
              inputMode="tel"
              className={inputClass}
            />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label={jobsL('date')}>
          <input
            type="date"
            name="date"
            required
            defaultValue={initial?.date ?? toISODateLocal(new Date())}
            className={inputClass}
          />
        </Field>
        <Field label={jobsL('time')}>
          <input
            name="time"
            defaultValue={initial?.time ?? ''}
            placeholder="10:00 AM"
            maxLength={30}
            className={inputClass}
          />
        </Field>
        <Field label={T('formPriceLabel').replace('{symbol}', currencySymbol(currency))}>
          <input
            type="number"
            name="price"
            required
            min={0}
            step="0.01"
            defaultValue={initial?.price ?? ''}
            placeholder="0"
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label={`${jobsL('address')} (${T('formOptional')})`}>
        <AddressAutocomplete
          name="address"
          defaultValue={initial?.address ?? ''}
          placeholder={T('formAddressPlaceholder')}
          maxLength={500}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={`${jobsL('technician')} (${T('formOptional')})`}>
          <input
            name="technician"
            defaultValue={initial?.technician ?? ''}
            placeholder={T('formTechnicianPlaceholder')}
            maxLength={120}
            className={inputClass}
          />
        </Field>
        <Field label={`${jobsL('notes')} (${T('formOptional')})`}>
          <textarea
            name="notes"
            defaultValue={initial?.notes ?? ''}
            placeholder={T('formNotesPlaceholder')}
            rows={2}
            maxLength={2000}
            className={inputClass}
          />
        </Field>
      </div>

      {state?.queued && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium rounded-xl px-3 py-2.5">
          <CloudOff size={14} className="mt-0.5 shrink-0" />
          <span>{T('formOffline')}</span>
        </div>
      )}

      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <button type="submit" disabled={isPending} className={primaryBtnClass}>
        <Save size={14} />
        {isPending ? t(locale, 'common.saving') : submitLabel}
      </button>
    </form>
  );
}
