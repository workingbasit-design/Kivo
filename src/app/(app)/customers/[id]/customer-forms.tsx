'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import { AlertCircle, Archive, ArchiveRestore, CheckCircle2, Pencil, Trash2, X } from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import {
  updateCustomer,
  deleteCustomer,
  archiveCustomer,
  unarchiveCustomer,
  type ActionResult,
} from '@/app/actions/customers';
import ConfirmDialog from '@/components/ConfirmDialog';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { CA_PROVINCES } from '@/lib/tax';
import { Button, Input, Select, Textarea } from '@/components/kit';

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
  // Wrap the server action so a successful save also exits editing mode.
  // (Leaving the form open with a "saved" banner forced a manual cancel -
  // found 2026-10-06.) setState here runs in the action's async context,
  // not inside an effect, so no cascading-render lint issue.
  const [state, formAction, isPending] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await updateCustomer(prev, formData);
    if (result?.ok) setEditing(false);
    return result;
  }, {});

  useResultToast(state, {
    success: t(locale, 't10money.customerSaved'),
  });

  if (!editing) {
    return (
      <Button variant="secondary" sm onClick={() => setEditing(true)}>
        <Pencil size={14} /> Edit
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={customer.id} />

      <Input label="Name *" name="name" required defaultValue={customer.name} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Phone"
          hint="e.g. +1 416 555 0100"
          name="phone"
          type="tel"
          defaultValue={customer.phone ?? ''}
        />
        <Input
          label="Email"
          name="email"
          type="email"
          defaultValue={customer.email ?? ''}
          placeholder="customer@example.com"
        />
      </div>

      <label className="field">
        <span>Address</span>
        <AddressAutocomplete
          name="address"
          rows={2}
          defaultValue={customer.address ?? ''}
          className="input"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Province"
          name="province"
          defaultValue={customer.province ?? ''}
          options={[
            { value: '', label: '-' },
            ...CA_PROVINCES.map((p) => ({ value: p.code, label: p.name })),
          ]}
        />
        <Input
          label="Postal code"
          hint="e.g. M5V 2T6"
          name="postalCode"
          defaultValue={customer.postalCode ?? ''}
          maxLength={7}
        />
      </div>

      <Textarea label="Notes" name="notes" rows={3} defaultValue={customer.notes ?? ''} />

      <Input
        label="Tags"
        hint="Comma-separated, e.g. vip, senior"
        name="tags"
        defaultValue={customer.tags ?? ''}
        maxLength={400}
      />

      {state?.error && (
        <div className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state?.ok && (
        <div className="flex items-start gap-2 bg-ok-bg border border-line text-ok text-xs font-medium rounded-xl px-3 py-2.5">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          <span>{t(locale, 't10money.customerSaved')}</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? t(locale, 't10money.custEditSaving') : t(locale, 't10money.custEditSaveChanges')}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
          <X size={14} /> {t(locale, 't10money.custEditCancel')}
        </Button>
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
  // The error is ALSO rendered inside the dialog (morning QA 2026-10-15):
  // it used to appear behind the open overlay, making "Yes, delete" look dead.
  useResultToast(state, {
    success: t(locale, 't10money.customerDeleted'),
  });

  return (
    <>
      <Button variant="danger" sm onClick={() => setConfirming(true)}>
        <Trash2 size={14} /> {t(locale, 't10money.custDelete')}
      </Button>
      <ConfirmDialog
        open={confirming}
        locale={locale}
        title={t(locale, 't10money.custDelete')}
        message={t(locale, 't10money.custDeleteMsg').replace('{name}', customerName)}
        busy={isPending}
        error={state?.error ?? null}
        onConfirm={() => {
          const fd = new FormData();
          fd.append('id', customerId);
          formAction(fd);
        }}
        onClose={() => !isPending && setConfirming(false)}
      />
    </>
  );
}

/**
 * Archive / restore a customer (morning QA 2026-10-15). The archiveCustomer
 * server action existed with no UI, so customers could never be archived —
 * and deleteCustomer refuses non-archived customers, making delete a
 * dead end. This wires the existing actions up.
 */
export function ArchiveCustomerButton({
  customerId,
  archived,
  locale = 'en',
}: {
  customerId: string;
  archived: boolean;
  locale?: Locale;
}) {
  const [state, formAction, isPending] = useActionState(
    archived ? unarchiveCustomer : archiveCustomer,
    {}
  );

  useResultToast(state, {
    success: t(locale, archived ? 't10money.custRestored' : 't10money.custArchived'),
  });

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={customerId} />
      <Button type="submit" variant="secondary" sm disabled={isPending}>
        {archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
        {isPending
          ? t(locale, archived ? 't10money.custRestoring' : 't10money.custArchiving')
          : t(locale, archived ? 't10money.custRestore' : 't10money.custArchive')}
      </Button>
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
