'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import { AlertCircle, Save } from '@/components/icons';
import { toast } from 'sonner';
import { Button, Input, Select, Textarea } from '@/components/kit';
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
  /** Optional - falls back to the `kivo-locale` cookie so pages that don't
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

      <Input
        label={T('recurFormTitleLabel')}
        name="title"
        required
        autoFocus
        defaultValue={initial?.title ?? ''}
        placeholder={T('recurFormTitlePlaceholder')}
        maxLength={200}
      />

      <Select
        label={jobsL('customer')}
        name="customerId"
        required
        defaultValue={initial?.customerId ?? customers[0]?.id ?? ''}
        options={customers.map((c) => ({ value: c.id, label: c.name }))}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label={T('recurFormFrequency')}
          hint={T('recurFormFrequencyHint')}
          name="frequency"
          required
          defaultValue={initial?.frequency ?? 'MONTHLY'}
          options={RECURRING_FREQUENCIES.map((f) => ({ value: f, label: freqLabel(f) }))}
        />

        <Input
          label={initial?.id ? T('recurFormNextRun') : T('recurFormFirstRun')}
          hint={T('recurFormRunHint')}
          type="date"
          name="startDate"
          required
          defaultValue={initial?.startDate ?? todayISO}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label={T('recurFormService')}
          hint={T('recurFormServiceHint')}
          onChange={(e) => handleServicePick(e.target.value)}
          defaultValue=""
          options={[
            { value: '', label: T('recurFormServicePick') },
            ...services.map((s) => ({
              value: s.id,
              label: `${s.name} - ${formatMoney(s.price, currency)}`,
            })),
          ]}
        />

        <Input
          label={T('recurFormPrice').replace('{symbol}', currencySymbol(currency))}
          type="text"
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          name="price"
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={T('recurFormPricePlaceholder')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label={jobsL('time')}
          type="text"
          name="time"
          defaultValue={initial?.time ?? ''}
          placeholder="10:00 AM"
          maxLength={30}
        />

        <Input
          label={jobsL('address')}
          type="text"
          name="address"
          defaultValue={initial?.address ?? ''}
          placeholder={T('recurFormAddressPlaceholder')}
          maxLength={500}
        />
      </div>

      <Textarea
        label={`${jobsL('notes')} (${T('formOptional')})`}
        name="notes"
        defaultValue={initial?.notes ?? ''}
        rows={3}
        maxLength={2000}
        placeholder={T('recurFormNotesPlaceholder')}
      />

      {state.error && (
        <div className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-4 py-3">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {state.error}
        </div>
      )}

      <Button type="submit" variant="primary" disabled={isPending}>
        <Save size={14} />
        {isPending ? t(locale, 'common.saving') : submitLabel}
      </Button>
    </form>
  );
}
