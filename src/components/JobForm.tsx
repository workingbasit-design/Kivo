'use client';

import React, { useActionState, useState } from 'react';
import { AlertCircle, Save } from 'lucide-react';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { toISODateLocal } from '@/lib/utils';
import type { JobActionResult } from '@/app/actions/jobs';

export interface JobFormCustomer {
  id: string;
  name: string;
}

export interface JobFormInitial {
  id?: string;
  title?: string;
  customerId?: string;
  date?: string; // YYYY-MM-DD
  time?: string | null;
  address?: string | null;
  price?: number;
  notes?: string | null;
  technician?: string | null;
}

/**
 * Shared create/edit job form. Quick-create stays minimal so a job
 * can be captured in under 20 seconds, even for a brand-new customer.
 */
export default function JobForm({
  customers,
  initial,
  action,
  submitLabel,
}: {
  customers: JobFormCustomer[];
  initial?: JobFormInitial;
  action: (_prev: JobActionResult, formData: FormData) => Promise<JobActionResult>;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  const [customerChoice, setCustomerChoice] = useState<string>(
    initial?.customerId ?? (customers[0]?.id ?? '__NEW__')
  );
  const showNewCustomer = customerChoice === '__NEW__';

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <Field label="Job title">
        <input
          name="title"
          required
          autoFocus
          defaultValue={initial?.title ?? ''}
          placeholder="e.g. AC repair, tap leakage, deep cleaning"
          maxLength={200}
          className={inputClass}
        />
      </Field>

      <Field label="Customer">
        <select
          name="customerId"
          value={customerChoice}
          onChange={(e) => setCustomerChoice(e.target.value)}
          className={inputClass}
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="__NEW__">＋ New customer…</option>
        </select>
      </Field>

      {showNewCustomer && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#f8f6ff] border border-[#e5d8fd] rounded-2xl">
          <Field label="New customer name">
            <input
              name="newCustomerName"
              placeholder="e.g. Priya Nair"
              maxLength={120}
              className={inputClass}
            />
          </Field>
          <Field label="Phone (optional)">
            <input
              name="newCustomerPhone"
              placeholder="+91 …"
              maxLength={25}
              inputMode="tel"
              className={inputClass}
            />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="Date">
          <input
            type="date"
            name="date"
            required
            defaultValue={initial?.date ?? toISODateLocal(new Date())}
            className={inputClass}
          />
        </Field>
        <Field label="Time">
          <input
            name="time"
            defaultValue={initial?.time ?? ''}
            placeholder="10:00 AM"
            maxLength={30}
            className={inputClass}
          />
        </Field>
        <Field label="Price (Rs)">
          <input
            type="number"
            name="price"
            required
            min={0}
            step="1"
            defaultValue={initial?.price ?? ''}
            placeholder="0"
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Address (optional)">
        <AddressAutocomplete
          name="address"
          defaultValue={initial?.address ?? ''}
          placeholder="Flat / street / area"
          maxLength={500}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Technician (optional)">
          <input
            name="technician"
            defaultValue={initial?.technician ?? ''}
            placeholder="Who is doing this job?"
            maxLength={120}
            className={inputClass}
          />
        </Field>
        <Field label="Notes (optional)">
          <textarea
            name="notes"
            defaultValue={initial?.notes ?? ''}
            placeholder="Anything the technician should know…"
            rows={2}
            maxLength={2000}
            className={inputClass}
          />
        </Field>
      </div>

      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <button type="submit" disabled={isPending} className={primaryBtnClass}>
        <Save size={14} />
        {isPending ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
