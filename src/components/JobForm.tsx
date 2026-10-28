'use client';

import React, { useActionState, useEffect, useState } from 'react';
import { AlertCircle, CloudOff, Save } from '@/components/icons';
import { toast } from 'sonner';
import { Button, Input, Select, Textarea } from '@/components/kit';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { toISODateLocal } from '@/lib/utils';
import { currencySymbol } from '@/lib/money';
import { t, type Locale } from '@/lib/i18n';
import type { JobActionResult } from '@/app/actions/jobs';

export interface JobFormCustomer {
  id: string;
  name: string;
}

export interface JobFormProperty {
  id: string;
  customerId: string;
  label: string;
  address: string;
  province: string | null;
}

export interface JobFormInitial {
  id?: string;
  title?: string;
  customerId?: string;
  date?: string; // YYYY-MM-DD
  time?: string | null;
  address?: string | null;
  price?: number;
  noCharge?: boolean;
  notes?: string | null;
  technician?: string | null;
  crewId?: string | null;
  /** Service property this job is performed at (create + edit). */
  propertyId?: string | null;
  /** Price-book service this job was created from (create flow only). */
  serviceId?: string;
  /** Checklist template this job was created from (create flow only). */
  templateId?: string;
}

export interface JobFormCrew {
  id: string;
  name: string;
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
  crews,
  properties,
  initial,
  action,
  submitLabel,
  locale: localeProp,
  currency,
}: {
  customers: JobFormCustomer[];
  /** Optional crew options for the crew <select> (omitted when crews aren't loaded). */
  crews?: JobFormCrew[];
  /** Optional server-provided service properties (edit page); otherwise
   *  they arrive via the live /api/customers/options refresh. */
  properties?: JobFormProperty[];
  initial?: JobFormInitial;
  action: (_prev: JobActionResult, formData: FormData) => Promise<JobActionResult>;
  submitLabel: string;
  /** Optional - falls back to the `kivo-locale` cookie so pages that don't
   *  pass it (e.g. /jobs/new) still render in the user's language. */
  locale?: Locale;
  /** Business currency code - drives the price label (e.g. CAD). */
  currency?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  const [locale] = useState<Locale>(() => resolveLocale(localeProp));
  const T = (k: string) => t(locale, `t10work.${k}`);
  const jobsL = (k: string) => t(locale, `jobs.${k}`);
  const crewsL = (k: string) => t(locale, `crews.${k}`);
  // Freshness: the SSR `customers` prop can be stale (client-side navigation
  // reuses cached RSC). Refresh on mount so a customer created moments ago
  // always appears in the combobox.
  const [liveCustomers, setLiveCustomers] = useState<JobFormCustomer[]>(customers);
  // Service properties arrive with the same refresh (tenant-scoped, and
  // filtered below to the selected customer). The edit page's initial
  // property is kept even before the refresh lands.
  const [liveProperties, setLiveProperties] = useState<JobFormProperty[]>([]);
  const [priceValue, setPriceValue] = useState<string>(String(initial?.price ?? ''));
  const [noCharge, setNoCharge] = useState<boolean>(initial?.noCharge ?? false);
  // Every typed field is CONTROLLED, not defaultValue: React's
  // useActionState resets the form element when the server action
  // returns (even an application-level { error }), which silently wiped
  // the user's title/price/address after any validation failure and left
  // them re-submitting an emptied form (found live 2026-10-28: a $0 job
  // could never be fixed by ticking "No charge", because the price field
  // was already empty on the retry). State-owned values survive the reset.
  const [titleValue, setTitleValue] = useState(initial?.title ?? '');
  const [dateValue, setDateValue] = useState(initial?.date ?? toISODateLocal(new Date()));
  const [timeValue, setTimeValue] = useState(initial?.time ?? '');
  const [addressValue, setAddressValue] = useState(initial?.address ?? '');
  const [technicianValue, setTechnicianValue] = useState(initial?.technician ?? '');
  const [crewValue, setCrewValue] = useState(initial?.crewId ?? '');
  const [notesValue, setNotesValue] = useState(initial?.notes ?? '');
  const [newCustomerNameValue, setNewCustomerNameValue] = useState('');
  const [newCustomerPhoneValue, setNewCustomerPhoneValue] = useState('');
  const [propertyValue, setPropertyValue] = useState(initial?.propertyId ?? '');
  const priceIsZero = (() => {
    const n = parseFloat(priceValue);
    return priceValue.trim() !== '' && Number.isFinite(n) && n === 0;
  })();
  const showZeroWarning = priceIsZero && !noCharge;
  useEffect(() => {
    let cancelled = false;
    fetch('/api/customers/options', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.customers)) {
          setLiveCustomers(data.customers);
        }
        if (!cancelled && Array.isArray(data?.properties)) {
          setLiveProperties(data.properties);
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
  // Switching customers resets the property link (a property belongs to
  // exactly one customer) — except when switching back to the job's
  // original customer on the edit page, which restores the saved link.
  const onCustomerChange = (value: string) => {
    setCustomerChoice(value);
    setPropertyValue(value === initial?.customerId ? (initial?.propertyId ?? '') : '');
  };
  const showNewCustomer = customerChoice === '__NEW__';
  // Service properties for the picker: server-provided on the edit page,
  // otherwise the live refresh above. Filtered to the selected customer.
  // The picker is uncontrolled (defaultValue) and remounts on customer
  // change (key), so switching customers always clears the link — a
  // property belongs to exactly one customer.
  const effectiveProperties = (properties ?? liveProperties).filter(
    (p) => p.customerId === customerChoice
  );
  const onPropertyChange = (value: string) => {
    if (!value) return;
    const prop = effectiveProperties.find((p) => p.id === value);
    if (!prop) return;
    // Prefill the address only when it is still empty — never overwrite
    // a hand-typed address. State-owned (not a DOM write) so the prefill
    // survives the post-action form reset like every other field.
    if (addressValue.trim() === '') {
      setAddressValue(prop.address);
    }
  };

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id && <input
            autoComplete="off" type="hidden" name="id" value={initial.id} />}
      {initial?.serviceId && <input
            autoComplete="off" type="hidden" name="serviceId" value={initial.serviceId} />}
      {initial?.templateId && <input
            autoComplete="off" type="hidden" name="templateId" value={initial.templateId} />}

      <Input
        label={T('formTitleLabel')}
        name="title"
        required
        autoFocus
        autoComplete="off"
        value={titleValue}
        onChange={(e) => setTitleValue(e.target.value)}
        placeholder={T('formTitlePlaceholder')}
        maxLength={200}
      />

      <Select
        label={jobsL('customer')}
        name="customerId"
        value={customerChoice}
        onChange={(e) => onCustomerChange(e.target.value)}
        options={[
          ...liveCustomers.map((c) => ({ value: c.id, label: c.name })),
          { value: '__NEW__', label: T('formNewCustomerOption') },
        ]}
      />

      {!showNewCustomer && (
        <Select
          key={customerChoice}
          label={jobsL('serviceProperty')}
          name="propertyId"
          // Controlled like every other field so a failed submit cannot
          // wipe the link; the customer-change handler above owns the
          // reset semantics (clear on switch, restore on return).
          value={propertyValue}
          onChange={(e) => {
            setPropertyValue(e.target.value);
            onPropertyChange(e.target.value);
          }}
          options={[
            { value: '', label: jobsL('noSpecificProperty') },
            ...effectiveProperties.map((p) => ({
              value: p.id,
              label: `${p.label} — ${p.address}${p.province ? ` (${p.province})` : ''}`,
            })),
          ]}
        />
      )}

      {showNewCustomer && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-paper border border-smoke rounded-2xl">
          <Input
            label={T('formNewCustomerName')}
            name="newCustomerName"
            autoComplete="off"
            value={newCustomerNameValue}
            onChange={(e) => setNewCustomerNameValue(e.target.value)}
            placeholder={T('formNewCustomerNamePlaceholder')}
            maxLength={120}
          />
          <Input
            label={T('formNewCustomerPhone')}
            name="newCustomerPhone"
            autoComplete="off"
            value={newCustomerPhoneValue}
            onChange={(e) => setNewCustomerPhoneValue(e.target.value)}
            placeholder={T('formPhonePlaceholder')}
            maxLength={25}
            inputMode="tel"
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          label={jobsL('date')}
          type="date"
          name="date"
          required
          autoComplete="off"
          value={dateValue}
          onChange={(e) => setDateValue(e.target.value)}
        />
        <Input
          label={jobsL('time')}
          name="time"
          autoComplete="off"
          value={timeValue}
          onChange={(e) => setTimeValue(e.target.value)}
          placeholder="10:00 AM"
          maxLength={30}
        />
        <div>
          <label htmlFor="job-price" className="block text-xs font-semibold text-ink mb-1.5">
            {T('formPriceLabel').replace('{symbol}', currencySymbol(currency))}
          </label>
          <input
            id="job-price"
            autoComplete="off"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            name="price"
            required
            value={priceValue}
            placeholder="0"
            className="input"
            onChange={(e) => setPriceValue(e.target.value)}
            // Normalize float artifacts (e.g. 149.99000549316406) on blur so
            // the displayed value always matches the cents-rounded save.
            // State-owned (not a direct DOM write): a DOM write here would
            // desync React's value tracker and get reverted on re-render.
            onBlur={(e) => {
              const n = parseFloat(e.target.value);
              if (Number.isFinite(n)) setPriceValue(n.toFixed(2));
            }}
          />
          {showZeroWarning && (
            <p role="alert" className="mt-2 flex items-start gap-2 text-xs font-semibold text-warn-text bg-warn-bg border border-warn-line rounded-xl px-3 py-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden />
              No price set - is this a no-charge job?
            </p>
          )}
          <label className="mt-3 flex items-center gap-2.5 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              name="noCharge"
              checked={noCharge}
              onChange={(e) => setNoCharge(e.target.checked)}
              className="h-5 w-5 rounded-md border-line-strong accent-ink"
            />
            <span className="text-sm text-ink">
              {T('formNoCharge')}{' '}
              <span className="text-ink-2">{T('formNoChargeHint')}</span>
            </span>
          </label>
        </div>
      </div>

      <div>
        <span className="block text-xs font-semibold text-ink mb-1.5">{`${jobsL('address')} (${T('formOptional')})`}</span>
        <AddressAutocomplete
          name="address"
          value={addressValue}
          onChange={setAddressValue}
          placeholder={T('formAddressPlaceholder')}
          maxLength={500}
          className="input"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label={`${jobsL('technician')} (${T('formOptional')})`}
          name="technician"
          autoComplete="off"
          value={technicianValue}
          onChange={(e) => setTechnicianValue(e.target.value)}
          placeholder={T('formTechnicianPlaceholder')}
          maxLength={120}
        />
        {crews && crews.length > 0 && (
          <Select
            label={crewsL('jobCrewOptional')}
            name="crewId"
            value={crewValue}
            onChange={(e) => setCrewValue(e.target.value)}
            options={[
              { value: '', label: crewsL('jobCrewNone') },
              ...crews.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        )}
        <Textarea
          label={`${jobsL('notes')} (${T('formOptional')})`}
          name="notes"
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          placeholder={T('formNotesPlaceholder')}
          rows={2}
          maxLength={2000}
        />
      </div>

      {state?.queued && (
        <div className="flex items-start gap-2 bg-warn-bg border border-warn-line text-warn-text text-xs font-medium rounded-xl px-3 py-2.5">
          <CloudOff size={14} className="mt-0.5 shrink-0" />
          <span>{T('formOffline')}</span>
        </div>
      )}

      {state?.error && (
        <div className="flex items-start gap-2 bg-danger-bg border border-danger/25 text-danger text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <Button variant="primary" type="submit" disabled={isPending} className="disabled:opacity-60 disabled:cursor-not-allowed">
        <Save size={14} />
        {isPending ? t(locale, 'common.saving') : submitLabel}
      </Button>
    </form>
  );
}
