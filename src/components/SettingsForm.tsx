'use client';

import React, { useActionState, useEffect, useState } from 'react';
import { AlertCircle, Globe, Save } from '@/components/icons';
import { toast } from 'sonner';
import { updateBusinessSettings, type SettingsResult } from '@/app/actions/settings';
import { Button, Card, Input, Select, Textarea } from '@/components/kit';
import { CA_PROVINCES } from '@/lib/tax';
import { WEEK_DAYS, parseWorkingHours, type DayKey } from '@/lib/working-hours';
import { useResolvedT } from '@/hooks/useResolvedLocale';
import { TimeField } from '@/components/TimeField';
import type { Locale } from '@/lib/i18n';

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

/** Curated IANA timezones - the business's "today" for schedule + dashboard. */
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
  locale,
}: {
  initial: string;
  t: (path: string) => string;
  locale: Locale;
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
            className="rounded-xl border border-line bg-surface-2 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink">{label}</span>
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
                <TimeField
                  value={state.open}
                  onChange={(v) => setDay(d.key, { open: v, close: state.close })}
                  locale={locale}
                  name={`wh_${d.key}_open`}
                  ariaLabel={`${label} - ${t('t10misc.settings.workingHoursSetHours')}`}
                />
                <span className="text-xs text-ink-2" aria-hidden="true">-</span>
                <TimeField
                  value={state.close}
                  onChange={(v) => setDay(d.key, { open: state.open, close: v })}
                  locale={locale}
                  name={`wh_${d.key}_close`}
                  ariaLabel={`${label} - ${t('t10misc.settings.workingHoursSetClosed')}`}
                />
              </div>
            ) : (
              <p className="text-xs text-ink-2 italic mt-1.5">{t('t10misc.settings.closed')}</p>
            )}
          </div>
        );
      })}
      <p className="text-[11px] text-ink-2 pt-1">{t('t10misc.settings.hoursHint')}</p>
    </div>
  );
}

export default function SettingsForm({ business }: { business: BusinessFormData }) {
  const { t, locale } = useResolvedT();
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
        <Input
          label={t('t10misc.auth.businessName')}
          name="name"
          type="text"
          required
          defaultValue={business.name}
          maxLength={200}
        />

        {/* Tax settings - Canada only */}
        <div className="rounded-xl border border-line bg-surface-2 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-ink-2" />
            <p className="text-sm font-bold text-ink">{t('t10misc.settings.taxTitle')}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Select
              label={t('t10misc.settings.provinceLabel')}
              hint={t('t10misc.settings.provinceHint')}
              name="taxRegion"
              defaultValue={business.taxRegion || 'ON'}
              options={CA_PROVINCES.map((p) => ({
                value: p.code,
                label: `${p.name} (${p.code})`,
              }))}
            />
            <Input
              label={t('t10misc.settings.gstLabel')}
              hint={t('t10misc.settings.gstHint')}
              name="taxId"
              type="text"
              defaultValue={business.taxId}
              maxLength={15}
              placeholder="123456789RT0001"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label={t('t10misc.settings.phoneLabel')}
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={business.phone}
            maxLength={25}
            placeholder="+1 416 555 0100"
          />
          <Input
            label={t('t10misc.settings.whatsappLabel')}
            hint={t('t10misc.settings.whatsappHint')}
            name="whatsappNumber"
            type="tel"
            autoComplete="tel"
            defaultValue={business.whatsappNumber}
            maxLength={25}
            placeholder="+1 416 555 0100"
          />
        </div>

        {/* kit .field wrapper gives the custom editor the same label rhythm */}
        <div className="field">
          <span>{t('t10misc.settings.hoursLabel')}</span>
          <WorkingHoursEditor initial={business.workingHours} t={t} locale={locale} />
        </div>

        <Textarea
          label={t('t10misc.settings.addressLabel')}
          hint={t('t10misc.settings.addressHint')}
          name="address"
          rows={2}
          defaultValue={business.address}
          maxLength={500}
          placeholder={t('t10misc.settings.addressPlaceholder')}
        />

        {/* EveryJob directory (customer discovery) */}
        <div className="rounded-xl border border-line bg-surface-2 p-4 space-y-3">
          <p className="text-sm font-bold text-ink">{t('t10misc.settings.directoryTitle')}</p>
          <p className="text-xs text-ink-2 -mt-2">{t('t10misc.settings.directoryDesc')}</p>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="directoryOptIn"
              defaultChecked={business.directoryOptIn}
              className="mt-0.5 h-5 w-5 rounded accent-ink shrink-0"
            />
            <span className="text-xs text-ink">
              <span className="font-semibold">{t('t10misc.settings.directoryOptIn')}</span>
              <span className="block text-ink-2 mt-0.5">{t('t10misc.settings.directoryOptInHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="directoryHideAddress"
              defaultChecked={business.directoryHideAddress}
              className="mt-0.5 h-5 w-5 rounded accent-ink shrink-0"
            />
            <span className="text-xs text-ink">
              <span className="font-semibold">{t('t10misc.settings.directoryHide')}</span>
              <span className="block text-ink-2 mt-0.5">{t('t10misc.settings.directoryHideHint')}</span>
            </span>
          </label>
        </div>

        <Input
          label={t('t10misc.settings.interacLabel')}
          hint={t('t10misc.settings.interacHint')}
          name="interacEmail"
          type="email"
          defaultValue={business.interacEmail}
          maxLength={255}
          placeholder="payments@yourbusiness.ca"
          autoComplete="email"
        />

        <Select
          label={t('t10misc.settings.timezoneLabel')}
          hint={t('t10misc.settings.timezoneHint')}
          name="timezone"
          defaultValue={business.timezone || 'America/Toronto'}
          options={TIMEZONES.map((tz) => ({ value: tz.value, label: tz.label }))}
        />

        {state?.error && (
          <div role="alert" className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <Button type="submit" variant="primary" disabled={isPending} className="w-full sm:w-auto">
          <Save size={14} />
          {isPending ? t('t10misc.settings.saving') : t('t10misc.settings.save')}
        </Button>
      </form>
    </Card>
  );
}
