'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { t, type Locale } from '@/lib/i18n';
import { Field, inputClass } from '@/components/ui';
import { createEquipment, updateEquipment, type ActionResult } from '@/app/actions/equipment';

const initialState: ActionResult = { ok: false };

export default function EquipmentForm({
  customers,
  preselectedCustomerId,
  existing,
  locale,
  mode,
}: {
  customers: { id: string; name: string }[];
  preselectedCustomerId?: string | null;
  existing?: {
    id: string;
    name: string;
    brand: string | null;
    model: string | null;
    serial: string | null;
    installDate: string | null;
    notes: string | null;
  } | null;
  locale: Locale;
  mode: 'create' | 'edit';
}) {
  const router = useRouter();
  const T = (k: string) => t(locale, `equipment.${k}`);

  const action = async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => {
    const res =
      mode === 'create'
        ? await createEquipment(formData)
        : await updateEquipment(existing!.id, formData);
    if (res.ok) {
      router.push(res.id ? `/equipment/${res.id}` : '/equipment');
      router.refresh();
    }
    return res;
  };

  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {mode === 'create' && (
        <Field label={T('customer')}>
          <select
            name="customerId"
            required
            defaultValue={preselectedCustomerId ?? ''}
            className={inputClass}
          >
            <option value="">{T('selectCustomer')}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label={T('name')}>
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={existing?.name ?? ''}
          placeholder={T('namePlaceholder')}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={T('brand')}>
          <input name="brand" maxLength={100} defaultValue={existing?.brand ?? ''} className={inputClass} />
        </Field>
        <Field label={T('model')}>
          <input name="model" maxLength={100} defaultValue={existing?.model ?? ''} className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={T('serial')}>
          <input name="serial" maxLength={100} defaultValue={existing?.serial ?? ''} className={inputClass} />
        </Field>
        <Field label={T('installDate')}>
          <input
            name="installDate"
            type="date"
            defaultValue={existing?.installDate ?? ''}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label={T('notes')}>
        <textarea name="notes" rows={3} maxLength={2000} defaultValue={existing?.notes ?? ''} className={inputClass} />
      </Field>

      {state.error && <p className="text-sm font-medium text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full inline-flex items-center justify-center rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-graphite disabled:opacity-50 min-h-[48px]"
      >
        {pending ? '…' : mode === 'create' ? T('save') : T('update')}
      </button>
    </form>
  );
}
