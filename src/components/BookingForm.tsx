'use client';

import { useActionState, useState } from 'react';
import { CalendarCheck, CheckCircle2, Phone } from 'lucide-react';
import { submitBookingRequest } from '@/app/actions/booking';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import AddressAutocomplete from '@/components/AddressAutocomplete';

const initialState = { error: undefined as string | undefined, ok: undefined as boolean | undefined };

export default function BookingForm({
  slug,
  services,
  businessPhone,
  currency,
}: {
  slug: string;
  services: { id: string; name: string; price: number }[];
  businessPhone: string | null;
  currency?: string;
}) {
  const [state, formAction, pending] = useActionState(submitBookingRequest, initialState);
  // One key per form render: double-submits / retries carry the same key and
  // the server creates exactly one customer + job for it.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  if (state.ok) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-8 text-center">
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
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#6329d4]"
          >
            <Phone size={15} /> Call us: {businessPhone}
          </a>
        )}
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-6 space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

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
          <input name="date" type="date" required min={today} className={inputClass} />
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
      <p className="text-[11px] text-zinc-400 text-center">
        No advance payment needed — we confirm every request by phone.
      </p>
    </form>
  );
}
