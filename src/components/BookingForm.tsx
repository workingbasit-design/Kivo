'use client';

import { useActionState, useEffect, useState } from 'react';
import { CalendarCheck, CheckCircle2, Clock, Phone } from 'lucide-react';
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
}: {
  slug: string;
  services: { id: string; name: string; price: number }[];
  businessPhone: string | null;
  currency?: string;
  hoursSummary: string | null;
  strings: BookingSlotStrings;
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
        <h2 className="text-lg font-bold text-zinc-900 mb-1">Request received!</h2>
        <p className="text-sm text-zinc-500 max-w-sm mx-auto">
          Thank you — we&apos;ll call you back shortly to confirm your booking.
        </p>
        {businessPhone && (
          <a
            href={`tel:${businessPhone.replace(/\s/g, '')}`}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-ink"
          >
            <Phone size={15} /> Call us: {businessPhone}
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
        <Field label="Your name *">
          <input name="name" required minLength={2} maxLength={100} placeholder="e.g. Sarah Miller" className={inputClass} autoComplete="name" />
        </Field>
        <Field label="Phone *">
          <input name="phone" required maxLength={25} placeholder="e.g. 416 555 0100" className={inputClass} autoComplete="tel" inputMode="tel" />
        </Field>
      </div>

      <Field label="Address">
        <AddressAutocomplete name="address" rows={2} maxLength={500} placeholder="Where should we come?" className={inputClass} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Preferred date *">
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
        <Field label="Service needed">
          <select name="serviceId" className={inputClass} defaultValue="">
            <option value="">General / not sure yet</option>
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
                        ? 'px-2 py-2 rounded-xl text-xs font-bold bg-ink text-white shadow-sm'
                        : slot.available
                          ? 'px-2 py-2 rounded-xl text-xs font-semibold bg-zinc-50 border border-smoke text-zinc-700 hover:border-ink hover:text-ink'
                          : 'px-2 py-2 rounded-xl text-xs font-medium bg-zinc-50 border border-smoke text-zinc-300 line-through cursor-not-allowed'
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

      <Field label="Notes">
        <textarea name="notes" rows={2} maxLength={1000} placeholder="Anything we should know?" className={inputClass} />
      </Field>

      {state.error && (
        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${primaryBtnClass} w-full justify-center !py-3 !text-sm`}>
        <CalendarCheck size={16} />
        {pending ? 'Requesting…' : 'Request booking'}
      </button>
      <p className="text-[11px] text-graphite text-center">
        No advance payment needed — we confirm every request by phone.
      </p>
    </form>
  );
}
