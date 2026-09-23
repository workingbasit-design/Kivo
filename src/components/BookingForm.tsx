'use client';

import { useActionState, useEffect, useState } from 'react';
import { CalendarCheck, CheckCircle2, Clock, Phone } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { getBookingSlots, submitBookingWithTime, type SlotsResult } from '@/app/actions/booking-slots';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import AddressAutocomplete from '@/components/AddressAutocomplete';

const initialState = { error: undefined as string | undefined, ok: undefined as boolean | undefined };

export interface BookingSlotStrings {
  preferredTime: string;
  loadingSlots: string;
  slotsError: string;
  dayClosed: string;
  hoursNotSetNote: string;
  someUnscheduledNote: string;
  noSlotsLeft: string;
}

export default function BookingForm({
  slug,
  services,
  businessPhone,
  currency,
  hoursSummary,
  strings,
  locale = 'en',
}: {
  slug: string;
  services: { id: string; name: string; price: number }[];
  businessPhone: string | null;
  currency?: string;
  hoursSummary: string | null;
  strings: BookingSlotStrings;
  locale?: Locale;
}) {
  const [state, formAction, pending] = useActionState(submitBookingWithTime, initialState);
  // One key per form render: double-submits / retries carry the same key and
  // the server creates exactly one customer + one job for it.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const [date, setDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsResult, setSlotsResult] = useState<SlotsResult | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const L = (path: string) => t(locale, path);

  // Date -> available slots. The server re-validates the chosen slot at
  // confirm time, so a stale pick can never double-book.
  useEffect(() => {
    setSelectedTime('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) {
      setSlotsResult(null);
      setSlotsLoading(false);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsResult(null);
    getBookingSlots(slug, date)
      .then((res) => {
        if (!cancelled) setSlotsResult(res);
      })
      .catch(() => {
        if (!cancelled)
          setSlotsResult({
            slots: [],
            closed: false,
            hoursNotSet: false,
            unscheduledCount: 0,
            error: strings.slotsError,
          });
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, slug, today, strings.slotsError]);

  if (state.ok) {
    return (
      <div className="bg-white rounded-2xl border border-smoke shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 mb-1">{L('t10money.bookingFormReceived')}</h2>
        <p className="text-sm text-zinc-500 max-w-sm mx-auto">
          {L('t10money.bookingFormThanks')}
        </p>
        {businessPhone && (
          <a
            href={`tel:${businessPhone.replace(/\s/g, '')}`}
            className="mt-5 min-h-[44px] inline-flex items-center gap-2 text-sm font-semibold text-ink"
          >
            <Phone size={15} /> {L('t10money.bookingFormCallUs').replace('{phone}', businessPhone)}
          </a>
        )}
      </div>
    );
  }

  const showSlots = !slotsLoading && slotsResult && !slotsResult.closed && !slotsResult.hoursNotSet && !slotsResult.error;
  const availableCount = showSlots ? slotsResult.slots.filter((s) => s.available).length : 0;

  return (
    <form action={formAction} className="bg-white rounded-2xl border border-smoke shadow-sm p-6 space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="time" value={selectedTime} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={L('t10money.bookingFormYourName')}>
          <input name="name" required minLength={2} maxLength={100} placeholder={L('t10money.bookingFormNamePlaceholder')} className={inputClass} autoComplete="name" />
        </Field>
        <Field label={L('t10money.bookingFormPhone')}>
          <input name="phone" required maxLength={25} placeholder={L('t10money.bookingFormPhonePlaceholder')} className={inputClass} autoComplete="tel" inputMode="tel" />
        </Field>
      </div>

      <Field label={L('t10money.bookingFormAddress')}>
        <AddressAutocomplete name="address" rows={2} maxLength={500} placeholder={L('t10money.bookingFormAddressPlaceholder')} className={inputClass} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={L('t10money.bookingFormDate')}>
          <input
            name="date"
            type="date"
            required
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={L('t10money.bookingFormService')}>
          <select name="serviceId" className={inputClass} defaultValue="">
            <option value="">{L('t10money.bookingFormGeneral')}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.price > 0 ? ` — ${formatMoney(s.price, currency)}` : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Time slot picker (only when the business configured working hours) */}
      <Field label={strings.preferredTime}>
        {hoursSummary && (
          <p className="text-[11px] text-graphite mb-2 flex items-center gap-1">
            <Clock size={11} /> {hoursSummary}
          </p>
        )}
        {slotsLoading && (
          <p className="text-xs text-graphite py-2">{strings.loadingSlots}</p>
        )}
        {!slotsLoading && !slotsResult && (
          <p className="text-xs text-graphite py-2">—</p>
        )}
        {slotsResult?.error && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            {slotsResult.error}
          </p>
        )}
        {slotsResult?.closed && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            {strings.dayClosed}
          </p>
        )}
        {slotsResult?.hoursNotSet && (
          <p className="text-xs text-zinc-500 bg-zinc-50 border border-smoke rounded-xl px-3 py-2">
            {strings.hoursNotSetNote}
          </p>
        )}
        {showSlots && availableCount === 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            {strings.noSlotsLeft}
          </p>
        )}
        {showSlots && availableCount > 0 && (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" role="radiogroup" aria-label={strings.preferredTime}>
              {slotsResult.slots.map((slot) => {
                const selected = selectedTime === slot.start;
                return (
                  <button
                    key={slot.start}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!slot.available}
                    onClick={() => setSelectedTime(slot.start)}
                    className={
                      selected
                        ? 'min-h-[44px] px-2 py-2 rounded-xl text-xs font-bold bg-ink text-white shadow-sm'
                        : slot.available
                          ? 'min-h-[44px] px-2 py-2 rounded-xl text-xs font-semibold bg-zinc-50 border border-smoke text-zinc-700 hover:border-ink hover:text-ink'
                          : 'min-h-[44px] px-2 py-2 rounded-xl text-xs font-medium bg-zinc-50 border border-smoke text-zinc-300 line-through cursor-not-allowed'
                    }
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
            {slotsResult.unscheduledCount > 0 && (
              <p className="text-[11px] text-graphite mt-2">{strings.someUnscheduledNote}</p>
            )}
          </>
        )}
      </Field>

      <Field label={L('t10money.bookingFormNotes')}>
        <textarea name="notes" rows={2} maxLength={1000} placeholder={L('t10money.bookingFormNotesPlaceholder')} className={inputClass} />
      </Field>

      {state.error && (
        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${primaryBtnClass} w-full justify-center min-h-[52px] !py-3 !text-sm`}>
        <CalendarCheck size={16} />
        {pending ? L('t10money.bookingFormRequesting') : L('t10money.bookingFormRequest')}
      </button>
      <p className="text-[11px] text-graphite text-center">
        {L('t10money.bookingFormNoPayment')}
      </p>
    </form>
  );
}
