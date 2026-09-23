'use client';

import React, { useActionState, useState } from 'react';
import { AlertCircle, CheckCircle2, Pencil, Trash2, X } from 'lucide-react';
import { updateCustomer, deleteCustomer } from '@/app/actions/customers';
import { Field, inputClass, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { CA_PROVINCES } from '@/lib/tax';

export type CustomerFormData = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  province: string | null;
  postalCode: string | null;
  notes: string | null;
  tags: string | null;
};

export function EditCustomerForm({ customer }: { customer: CustomerFormData }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateCustomer, {});

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className={secondaryBtnClass}>
        <Pencil size={14} /> Edit
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={customer.id} />

      <Field label="Name *">
        <input name="name" required defaultValue={customer.name} className={inputClass} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Phone" hint="e.g. +1 416 555 0100">
          <input
            name="phone"
            type="tel"
            defaultValue={customer.phone ?? ''}
            placeholder="+1 416 555 0100"
            className={inputClass}
          />
        </Field>
        <Field label="Email">
          <input
            name="email"
            type="email"
            defaultValue={customer.email ?? ''}
            placeholder="customer@example.com"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Address">
        <AddressAutocomplete
          name="address"
          rows={2}
          defaultValue={customer.address ?? ''}
          className={inputClass}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Province">
          <select name="province" defaultValue={customer.province ?? ''} className={inputClass}>
            <option value="">—</option>
            {CA_PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Postal code" hint="e.g. M5V 2T6">
          <input
            name="postalCode"
            defaultValue={customer.postalCode ?? ''}
            placeholder="M5V 2T6"
            maxLength={7}
            className={inputClass + ' uppercase'}
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea name="notes" rows={3} defaultValue={customer.notes ?? ''} className={inputClass} />
      </Field>

      <Field label="Tags" hint="Comma-separated, e.g. vip, senior">
        <input name="tags" defaultValue={customer.tags ?? ''} placeholder="vip, senior" maxLength={400} className={inputClass} />
      </Field>

      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state?.ok && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          <span>Saved.</span>
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={primaryBtnClass}>
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={() => setEditing(false)} className={secondaryBtnClass}>
          <X size={14} /> Cancel
        </button>
      </div>
    </form>
  );
}

export function DeleteCustomerButton({ customerId, customerName }: { customerId: string; customerName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState(deleteCustomer, {});

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-rose-600 hover:text-rose-700 px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 border border-rose-200 hover:bg-rose-50"
      >
        <Trash2 size={14} /> Delete
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={customerId} />
      <span className="text-xs text-zinc-600">
        Delete <strong>{customerName}</strong>? Jobs and invoices linked to them will also be removed.
      </span>
      <button
        type="submit"
        disabled={isPending}
        className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl font-semibold text-xs transition-colors disabled:opacity-60"
      >
        {isPending ? 'Deleting…' : 'Yes, delete'}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className={secondaryBtnClass}>
        Cancel
      </button>
      {state?.error && <span className="text-xs text-rose-600">{state.error}</span>}
    </form>
  );
}
