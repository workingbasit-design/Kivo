'use client';

import React, { useActionState, useState } from 'react';
import { AlertCircle, CheckCircle2, Globe, Save } from 'lucide-react';
import { updateBusinessSettings, type SettingsResult } from '@/app/actions/settings';
import { Card, Field, inputClass, primaryBtnClass } from '@/components/ui';
import { CA_PROVINCES } from '@/lib/tax';
import { currencyLabel, currencySymbol } from '@/lib/money';
import { WEEK_DAYS, parseWorkingHours, type DayKey } from '@/lib/working-hours';

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

function WorkingHoursEditor({ initial }: { initial: string }) {
  const [days, setDays] = useState<Record<DayKey, DayState>>(() =>
    initialDayState(initial)
  );

  const setDay = (key: DayKey, value: DayState) =>
    setDays((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-1.5">
      {WEEK_DAYS.map((d) => {
        const state = days[d.key];
        const open = state !== null;
        return (
          <div key={d.key} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-semibold text-zinc-700">{d.label}</span>
            {open ? (
              <>
                <input
                  type="time"
                  name={`wh_${d.key}_open`}
                  value={state.open}
                  onChange={(e) => setDay(d.key, { open: e.target.value, close: state.close })}
                  className={inputClass}
                  aria-label={`${d.label} opening time`}
                />
                <span className="text-xs text-zinc-400">–</span>
                <input
                  type="time"
                  name={`wh_${d.key}_close`}
                  value={state.close}
                  onChange={(e) => setDay(d.key, { open: state.open, close: e.target.value })}
                  className={inputClass}
                  aria-label={`${d.label} closing time`}
                />
                <button
                  type="button"
                  onClick={() => setDay(d.key, null)}
                  className="text-[11px] font-semibold text-zinc-500 hover:text-rose-600 px-2 py-1 shrink-0"
                >
                  Set closed
                </button>
              </>
            ) : (
              <>
                <span className="text-xs text-zinc-400 italic flex-1">Closed</span>
                <button
                  type="button"
                  onClick={() => setDay(d.key, { open: '09:00', close: '18:00' })}
                  className="text-[11px] font-semibold text-ink hover:underline px-2 py-1 shrink-0"
                >
                  Set hours
                </button>
              </>
            )}
          </div>
        );
      })}
      <p className="text-[11px] text-zinc-400 pt-1">
        Shown on your public booking page so customers know when you&apos;re available.
      </p>
    </div>
  );
}

export default function SettingsForm({ business }: { business: BusinessFormData }) {
  const [state, formAction, isPending] = useActionState<SettingsResult, FormData>(
    updateBusinessSettings,
    {}
  );

  return (
    <Card className="p-6 max-w-2xl">
      <form action={formAction} className="space-y-4">
        <Field label="Business name">
          <input name="name" type="text" required defaultValue={business.name} maxLength={200} className={inputClass} />
        </Field>

        {/* Tax settings — Canada only */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-zinc-500" />
            <p className="text-sm font-bold text-zinc-900">Tax</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              label="Province / territory"
              hint="Sets your GST / HST / PST / QST rates on new invoices and quotes."
            >
              <select name="taxRegion" defaultValue={business.taxRegion || 'ON'} className={inputClass}>
                {CA_PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="GST/HST number"
              hint="Your CRA business number, shown on invoices. Optional."
            >
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
          <Field label="Phone">
            <input name="phone" type="tel" defaultValue={business.phone} maxLength={25} placeholder="+1 416 555 0100" className={inputClass} />
          </Field>
          <Field
            label="WhatsApp number"
            hint="Used for WhatsApp chat links instead of your phone when set."
          >
            <input
              name="whatsappNumber"
              type="tel"
              defaultValue={business.whatsappNumber}
              maxLength={25}
              placeholder="+1 416 555 0100"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Working hours">
          <WorkingHoursEditor initial={business.workingHours} />
        </Field>

        <Field label="Address" hint="Include your city — it powers the weather strip on your Schedule page and the EveryJob directory.">
          <textarea name="address" rows={2} defaultValue={business.address} maxLength={500} placeholder="Shop/office address" className={inputClass} />
        </Field>

        {/* EveryJob directory (customer discovery) */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
          <p className="text-sm font-bold text-zinc-900">EveryJob directory</p>
          <p className="text-xs text-zinc-500 -mt-2">
            Your public profile helps new customers find you — free, no commission. It uses your booking-page link.
          </p>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="directoryOptIn"
              defaultChecked={business.directoryOptIn}
              className="mt-0.5 h-4 w-4 rounded accent-ink"
            />
            <span className="text-xs text-zinc-700">
              <span className="font-semibold">Show my business in the EveryJob directory</span>
              <span className="block text-zinc-500 mt-0.5">Customers can find your profile, services, reviews and send you quote requests.</span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="directoryHideAddress"
              defaultChecked={business.directoryHideAddress}
              className="mt-0.5 h-4 w-4 rounded accent-ink"
            />
            <span className="text-xs text-zinc-700">
              <span className="font-semibold">Hide my exact address</span>
              <span className="block text-zinc-500 mt-0.5">Show only your area/city on the public profile instead of the full address.</span>
            </span>
          </label>
        </div>

        <Field
          label="Interac e-Transfer email"
          hint="Shown on invoices so customers can pay you directly. EveryJob never touches the money."
        >
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

        <Field label="Business timezone" hint="Used for “today” on your schedule and dashboard.">
          <select name="timezone" defaultValue={business.timezone || 'America/Toronto'} className={inputClass}>
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </Field>

        {state?.error && (
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}
        {state?.ok && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl px-3 py-2.5">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>Settings saved.</span>
          </div>
        )}

        <button type="submit" disabled={isPending} className={primaryBtnClass}>
          <Save size={14} />
          {isPending ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </Card>
  );
}
