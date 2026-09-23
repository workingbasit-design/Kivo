'use client';

import React, { useActionState, useEffect, useState } from 'react';
import { AlertCircle, Globe, Save } from 'lucide-react';
import { toast } from 'sonner';
import { updateBusinessSettings, type SettingsResult } from '@/app/actions/settings';
import { Card, Field, inputClass, primaryBtnClass } from '@/components/ui';
import { CA_PROVINCES } from '@/lib/tax';
import { WEEK_DAYS, parseWorkingHours, type DayKey } from '@/lib/working-hours';
import { useResolvedT } from '@/hooks/useResolvedLocale';

export type BusinessFormData = {
  name: string;
  phone: string;
  address: string;
  taxId: string;
  interacEmail: string;
  timezone: string;
  whatsappNumber: string;
  workingHours: string; // JSON string, '' when not configured
  currency: string;
  taxRegion: string;
  directoryOptIn: boolean;
  directoryHideAddress: boolean;
};

/** Curated IANA timezones — the business's "today" for schedule + dashboard. */
const TIMEZONES = [
  { value: 'America/Toronto', label: 'Toronto (ET)' },
  { value: 'America/Halifax', label: 'Halifax (AT)' },
  { value: 'America/St_Johns', label: "St. John's (NT)" },
  { value: 'America/Winnipeg', label: 'Winnipeg (CT)' },
  { value: 'America/Regina', label: 'Regina (CT, no DST)' },
  { value: 'America/Edmonton', label: 'Edmonton (MT)' },
  { value: 'America/Vancouver', label: 'Vancouver (PT)' },
];

type DayState = { open: string; close: string } | null;

function initialDayState(raw: string): Record<DayKey, DayState> {
  const parsed = parseWorkingHours(raw);
  const out = {} as Record<DayKey, DayState>;
  for (const d of WEEK_DAYS) {
    const h = parsed?.[d.key];
    out[d.key] = h ? { open: h[0], close: h[1] } : null;
  }
  return out;
}

function WorkingHoursEditor({
  initial,
  t,
}: {
  initial: string;
  t: (path: string) => string;
}) {
  const [days, setDays] = useState<Record<DayKey, DayState>>(() =>
    initialDayState(initial)
  );

  const setDay = (key: DayKey, value: DayState) =>
    setDays((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-2">
      {WEEK_DAYS.map((d) => {
        const state = days[d.key];
        const open = state !== null;
        const label = t(`t10misc.settings.days.${d.key}`);
        return (
          <div
            key={d.key}
            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-700">{label}</span>
              <button
                type="button"
                onClick={() =>
                  open
                    ? setDay(d.key, null)
                    : setDay(d.key, { open: '09:00', close: '18:00' })
                }
                aria-pressed={open}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-[11px] font-semibold text-ink hover:underline px-2 py-1"
              >
                {open ? t('t10misc.settings.workingHoursSetClosed') : t('t10misc.settings.workingHoursSetHours')}
              </button>
            </div>
            {open ? (
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  type="time"
                  name={`wh_${d.key}_open`}
                  value={state.open}
                  onChange={(e) => setDay(d.key, { open: e.target.value, close: state.close })}
                  className={`${inputClass} flex-1`}
                  aria-label={`${label} — ${t('t10misc.settings.workingHoursSetHours')}`}
                />
                <span className="text-xs text-zinc-400" aria-hidden="true">–</span>
                <input
                  type="time"
                  name={`wh_${d.key}_close`}
                  value={state.close}
                  onChange={(e) => setDay(d.key, { open: state.open, close: e.target.value })}
                  className={`${inputClass} flex-1`}
                  aria-label={`${label} — ${t('t10misc.settings.workingHoursSetClosed')}`}
                />
              </div>
            ) : (
              <p className="text-xs text-zinc-400 italic mt-1.5">{t('t10misc.settings.closed')}</p>
            )}
          </div>
        );
      })}
      <p className="text-[11px] text-zinc-400 pt-1">{t('t10misc.settings.hoursHint')}</p>
    </div>
  );
}

export default function SettingsForm({ business }: { business: BusinessFormData }) {
  const { t } = useResolvedT();
  const [state, formAction, isPending] = useActionState<SettingsResult, FormData>(
    updateBusinessSettings,
    {}
  );

  useEffect(() => {
    if (state?.ok) toast.success(t('t10misc.settings.saved'));
    else if (state?.error) toast.error(state.error);
  }, [state, t]);

  return (
    <Card className="p-6 max-w-2xl">
      <form action={formAction} className="space-y-4">
        <Field label={t('t10misc.auth.businessName')}>
          <input name="name" type="text" required defaultValue={business.name} maxLength={200} className={inputClass} />
        </Field>

        {/* Tax settings — Canada only */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-zinc-500" />
            <p className="text-sm font-bold text-zinc-900">{t('t10misc.settings.taxTitle')}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t('t10misc.settings.provinceLabel')} hint={t('t10misc.settings.provinceHint')}>
              <select name="taxRegion" defaultValue={business.taxRegion || 'ON'} className={inputClass}>
                {CA_PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('t10misc.settings.gstLabel')} hint={t('t10misc.settings.gstHint')}>
              <input
                name="taxId"
                type="text"
                defaultValue={business.taxId}
                maxLength={15}
                placeholder="123456789RT0001"
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t('t10misc.settings.phoneLabel')}>
            <input name="phone" type="tel" autoComplete="tel" defaultValue={business.phone} maxLength={25} placeholder="+1 416 555 0100" className={inputClass} />
          </Field>
          <Field label={t('t10misc.settings.whatsappLabel')} hint={t('t10misc.settings.whatsappHint')}>
            <input
              name="whatsappNumber"
              type="tel"
              autoComplete="tel"
              defaultValue={business.whatsappNumber}
              maxLength={25}
              placeholder="+1 416 555 0100"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label={t('t10misc.settings.hoursLabel')}>
          <WorkingHoursEditor initial={business.workingHours} t={t} />
        </Field>

        <Field label={t('t10misc.settings.addressLabel')} hint={t('t10misc.settings.addressHint')}>
          <textarea name="address" rows={2} defaultValue={business.address} maxLength={500} placeholder={t('t10misc.settings.addressPlaceholder')} className={inputClass} />
        </Field>

        {/* EveryJob directory (customer discovery) */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
          <p className="text-sm font-bold text-zinc-900">{t('t10misc.settings.directoryTitle')}</p>
          <p className="text-xs text-zinc-500 -mt-2">{t('t10misc.settings.directoryDesc')}</p>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="directoryOptIn"
              defaultChecked={business.directoryOptIn}
              className="mt-0.5 h-5 w-5 rounded accent-ink shrink-0"
            />
            <span className="text-xs text-zinc-700">
              <span className="font-semibold">{t('t10misc.settings.directoryOptIn')}</span>
              <span className="block text-zinc-500 mt-0.5">{t('t10misc.settings.directoryOptInHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="directoryHideAddress"
              defaultChecked={business.directoryHideAddress}
              className="mt-0.5 h-5 w-5 rounded accent-ink shrink-0"
            />
            <span className="text-xs text-zinc-700">
              <span className="font-semibold">{t('t10misc.settings.directoryHide')}</span>
              <span className="block text-zinc-500 mt-0.5">{t('t10misc.settings.directoryHideHint')}</span>
            </span>
          </label>
        </div>

        <Field label={t('t10misc.settings.interacLabel')} hint={t('t10misc.settings.interacHint')}>
          <input
            name="interacEmail"
            type="email"
            defaultValue={business.interacEmail}
            maxLength={255}
            placeholder="payments@yourbusiness.ca"
            className={inputClass}
            autoComplete="email"
          />
        </Field>

        <Field label={t('t10misc.settings.timezoneLabel')} hint={t('t10misc.settings.timezoneHint')}>
          <select name="timezone" defaultValue={business.timezone || 'America/Toronto'} className={inputClass}>
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </Field>

        {state?.error && (
          <div role="alert" className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <button type="submit" disabled={isPending} className={`${primaryBtnClass} w-full sm:w-auto`}>
          <Save size={14} />
          {isPending ? t('t10misc.settings.saving') : t('t10misc.settings.save')}
        </button>
      </form>
    </Card>
  );
}
