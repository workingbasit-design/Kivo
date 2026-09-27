'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { t, type Locale } from '@/lib/i18n';
import { Field, inputClass } from '@/components/ui';
import { createPart, updatePart, type ActionResult } from '@/app/actions/inventory';

const initialState: ActionResult = { ok: false };

export default function PartForm({
  existing,
  locale,
  mode,
}: {
  existing?: {
    id: string;
    name: string;
    sku: string | null;
    quantity: number;
    reorderPoint: number | null;
    unitCost: number | null;
    unit: string | null;
    notes: string | null;
  } | null;
  locale: Locale;
  mode: 'create' | 'edit';
}) {
  const router = useRouter();
  const T = (k: string) => t(locale, `inventory.${k}`);

  const action = async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => {
    const res =
      mode === 'create' ? await createPart(formData) : await updatePart(existing!.id, formData);
    if (res.ok) {
      router.push('/inventory');
      router.refresh();
    }
    return res;
  };

  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
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
        <Field label={T('sku')}>
          <input name="sku" maxLength={50} defaultValue={existing?.sku ?? ''} className={inputClass} />
        </Field>
        <Field label={T('unit')}>
          <input
            name="unit"
            maxLength={20}
            defaultValue={existing?.unit ?? ''}
            placeholder={T('unitPlaceholder')}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={T('quantity')}>
          <input
            name="quantity"
            type="number"
            min={0}
            step="any"
            defaultValue={existing?.quantity ?? 0}
            className={inputClass}
          />
        </Field>
        <Field label={T('reorderPoint')} hint={T('reorderPointHint')}>
          <input
            name="reorderPoint"
            type="number"
            min={0}
            step="any"
            defaultValue={existing?.reorderPoint ?? ''}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label={T('unitCost')}>
        <input
          name="unitCost"
          type="number"
          min={0}
          step="0.01"
          defaultValue={existing?.unitCost ?? ''}
          className={inputClass}
        />
      </Field>

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
