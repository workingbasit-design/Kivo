'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { updateCustomer, deleteCustomer } from '@/app/actions/customers';
import {
  Field,
  FormGrid,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from '@/components/ui';
import ConfirmDialog from '@/components/ConfirmDialog';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { CA_PROVINCES } from '@/lib/tax';

/**
 * Fires a toast exactly once per server-action result. Minimal inline
 * replacement for the removed useActionToast helper.
 */
function useResultToast<T extends { ok?: boolean; error?: string }>(
  state: T | undefined,
  messages: { success?: string; error?: string }
) {
  const seen = useRef<T | undefined>(undefined);
  useEffect(() => {
    if (!state || seen.current === state) return;
    seen.current = state;
    if (state.ok && messages.success) {
      toast.success(messages.success);
    } else if (state.error) {
      toast.error(messages.error ?? state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

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

export function EditCustomerForm({
  customer,
  locale = 'en',
}: {
  customer: CustomerFormData;
  locale?: Locale;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateCustomer, {});

  useResultToast(state, {
    success: t(locale, 't10money.customerSaved'),
  });

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

      <FormGrid>
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
      </FormGrid>

      <Field label="Address">
        <AddressAutocomplete
          name="address"
          rows={2}
          defaultValue={customer.address ?? ''}
          className={inputClass}
        />
      </Field>

      <FormGrid>
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
      </FormGrid>

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
          <span>{t(locale, 't10money.customerSaved')}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={primaryBtnClass}>
          {isPending ? t(locale, 't10money.custEditSaving') : t(locale, 't10money.custEditSaveChanges')}
        </button>
        <button type="button" onClick={() => setEditing(false)} className={secondaryBtnClass}>
          <X size={14} /> {t(locale, 't10money.custEditCancel')}
        </button>
      </div>
    </form>
  );
}

export function DeleteCustomerButton({
  customerId,
  customerName,
  locale = 'en',
}: {
  customerId: string;
  customerName: string;
  locale?: Locale;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState(deleteCustomer, {});

  // deleteCustomer redirects to /customers on success; toast on failure only.
  useResultToast(state, {
    success: t(locale, 't10money.customerDeleted'),
  });

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="text-rose-600 hover:text-rose-700 min-h-[44px] px-4 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 border border-rose-200 hover:bg-rose-50"
      >
        <Trash2 size={14} /> {t(locale, 't10money.custDelete')}
      </button>
      <ConfirmDialog
        open={confirming}
        locale={locale}
        title={t(locale, 't10money.custDelete')}
        message={t(locale, 't10money.custDeleteMsg').replace('{name}', customerName)}
        busy={isPending}
        onConfirm={() => {
          const fd = new FormData();
          fd.append('id', customerId);
          formAction(fd);
        }}
        onClose={() => !isPending && setConfirming(false)}
      />
      {state?.error && <span className="text-xs text-rose-600">{state.error}</span>}
    </>
  );
}
