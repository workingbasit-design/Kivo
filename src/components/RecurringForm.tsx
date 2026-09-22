'use client';

import React, { useActionState, useState } from 'react';
import { AlertCircle, Save } from 'lucide-react';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import { toISODateLocal } from '@/lib/utils';
import { currencySymbol, formatMoney } from '@/lib/money';
import { RECURRING_FREQUENCIES } from '@/lib/validations';
import { frequencyLabel } from '@/lib/recurring';
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
}: {
  customers: RecurringFormCustomer[];
  services: RecurringFormService[];
  initial?: RecurringFormInitial;
  action: (_prev: RecurringActionResult, formData: FormData) => Promise<RecurringActionResult>;
  submitLabel: string;
  currency?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  const [price, setPrice] = useState<string>(initial?.price != null ? String(initial.price) : '');

  const todayISO = toISODateLocal(new Date());

  const handleServicePick = (serviceId: string) => {
    if (!serviceId) return;
    const svc = services.find((s) => s.id === serviceId);
    if (svc) setPrice(String(svc.price));
  };

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <Field label="Plan title">
        <input
          name="title"
          required
          autoFocus
          defaultValue={initial?.title ?? ''}
          placeholder="e.g. Monthly AC servicing, Weekly home cleaning"
          maxLength={200}
          className={inputClass}
        />
      </Field>

      <Field label="Customer">
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
        <Field label="Frequency" hint="How often a job is created from this plan.">
          <select
            name="frequency"
            required
            defaultValue={initial?.frequency ?? 'MONTHLY'}
            className={inputClass}
          >
            {RECURRING_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {frequencyLabel(f)}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label={initial?.id ? 'Next run date' : 'First run date'}
          hint="The next job is due on this date."
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
        <Field label="Service (from price book)" hint="Picking one fills the price below.">
          <select
            onChange={(e) => handleServicePick(e.target.value)}
            defaultValue=""
            className={inputClass}
          >
            <option value="">— pick a service —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {formatMoney(s.price, currency)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={`Price (${currencySymbol(currency)})`}>
          <input
            type="number"
            name="price"
            required
            min={0}
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 1499"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Time">
          <input
            type="text"
            name="time"
            defaultValue={initial?.time ?? ''}
            placeholder="e.g. 10:00 AM"
            maxLength={30}
            className={inputClass}
          />
        </Field>

        <Field label="Address">
          <input
            type="text"
            name="address"
            defaultValue={initial?.address ?? ''}
            placeholder="Job location"
            maxLength={500}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Notes (optional)">
        <textarea
          name="notes"
          defaultValue={initial?.notes ?? ''}
          rows={3}
          maxLength={2000}
          placeholder="Anything the technician should know each visit…"
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
        {isPending ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
