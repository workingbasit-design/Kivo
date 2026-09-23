'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import { AlertCircle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import { toISODateLocal } from '@/lib/utils';
import { currencySymbol, formatMoney } from '@/lib/money';
import { RECURRING_FREQUENCIES } from '@/lib/validations';
import { t, type Locale } from '@/lib/i18n';
import type { RecurringActionResult } from '@/app/actions/recurring';

export interface RecurringFormCustomer {
  id: string;
  name: string;
}

export interface RecurringFormService {
  id: string;
  name: string;
  price: number;
}

export interface RecurringFormInitial {
  id?: string;
  title?: string;
  customerId?: string;
  frequency?: string;
  startDate?: string; // YYYY-MM-DD
  time?: string | null;
  address?: string | null;
  price?: number;
  notes?: string | null;
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
 * Shared create/edit form for a recurring job plan. Pick a customer, a
 * service from the price book (fills the price), how often it repeats,
 * and when the first run happens.
 */
export default function RecurringForm({
  customers,
  services,
  initial,
  action,
  submitLabel,
  currency,
  locale: localeProp,
}: {
  customers: RecurringFormCustomer[];
  services: RecurringFormService[];
  initial?: RecurringFormInitial;
  action: (_prev: RecurringActionResult, formData: FormData) => Promise<RecurringActionResult>;
  submitLabel: string;
  currency?: string;
  /** Optional — falls back to the `kivo-locale` cookie so pages that don't
   *  pass it still render in the user's language. */
  locale?: Locale;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  const [locale] = useState<Locale>(() => resolveLocale(localeProp));
  const toastedFor = useRef<RecurringActionResult | null>(null);
  const T = (k: string) => t(locale, `t10work.${k}`);
  const jobsL = (k: string) => t(locale, `jobs.${k}`);
  const [price, setPrice] = useState<string>(initial?.price != null ? String(initial.price) : '');

  const todayISO = toISODateLocal(new Date());
  const freqLabel = (f: string) =>
    f === 'WEEKLY' ? T('freqWeekly') : f === 'BIWEEKLY' ? T('freqBiweekly') : f === 'MONTHLY' ? T('freqMonthly') : f;

  const handleServicePick = (serviceId: string) => {
    if (!serviceId) return;
    const svc = services.find((s) => s.id === serviceId);
    if (svc) setPrice(String(svc.price));
  };

  useEffect(() => {
    if (state && toastedFor.current !== state) {
      toastedFor.current = state;
      if (state.ok) toast.success(t(locale, 't10work.recurFormSaved'));
      else if (state.error) toast.error(state.error);
    }
  }, [state, locale]);

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <Field label={T('recurFormTitleLabel')}>
        <input
          name="title"
          required
          autoFocus
          defaultValue={initial?.title ?? ''}
          placeholder={T('recurFormTitlePlaceholder')}
          maxLength={200}
          className={inputClass}
        />
      </Field>

      <Field label={jobsL('customer')}>
        <select
          name="customerId"
          required
          defaultValue={initial?.customerId ?? customers[0]?.id ?? ''}
          className={inputClass}
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={T('recurFormFrequency')} hint={T('recurFormFrequencyHint')}>
          <select
            name="frequency"
            required
            defaultValue={initial?.frequency ?? 'MONTHLY'}
            className={inputClass}
          >
            {RECURRING_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {freqLabel(f)}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label={initial?.id ? T('recurFormNextRun') : T('recurFormFirstRun')}
          hint={T('recurFormRunHint')}
        >
          <input
            type="date"
            name="startDate"
            required
            defaultValue={initial?.startDate ?? todayISO}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={T('recurFormService')} hint={T('recurFormServiceHint')}>
          <select
            onChange={(e) => handleServicePick(e.target.value)}
            defaultValue=""
            className={inputClass}
          >
            <option value="">{T('recurFormServicePick')}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {formatMoney(s.price, currency)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={T('recurFormPrice').replace('{symbol}', currencySymbol(currency))}>
          <input
            type="number"
            name="price"
            required
            min={0}
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={T('recurFormPricePlaceholder')}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={jobsL('time')}>
          <input
            type="text"
            name="time"
            defaultValue={initial?.time ?? ''}
            placeholder="10:00 AM"
            maxLength={30}
            className={inputClass}
          />
        </Field>

        <Field label={jobsL('address')}>
          <input
            type="text"
            name="address"
            defaultValue={initial?.address ?? ''}
            placeholder={T('recurFormAddressPlaceholder')}
            maxLength={500}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label={`${jobsL('notes')} (${T('formOptional')})`}>
        <textarea
          name="notes"
          defaultValue={initial?.notes ?? ''}
          rows={3}
          maxLength={2000}
          placeholder={T('recurFormNotesPlaceholder')}
          className={inputClass}
        />
      </Field>

      {state.error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl px-4 py-3">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {state.error}
        </div>
      )}

      <button type="submit" disabled={isPending} className={primaryBtnClass}>
        <Save size={14} />
        {isPending ? t(locale, 'common.saving') : submitLabel}
      </button>
    </form>
  );
}
