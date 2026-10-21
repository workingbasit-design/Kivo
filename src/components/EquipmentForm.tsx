'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { t, type Locale } from '@/lib/i18n';
import { centsToDollars } from '@/lib/money';
import { Button, Input, Select, Textarea } from '@/components/kit';
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
    purchaseCostCents: number | null;
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
        <Select
          label={
            <>
              {T('customer')}
              <span className="text-danger ml-1" aria-hidden="true">*</span>
            </>
          }
          name="customerId"
          required
          defaultValue={preselectedCustomerId ?? ''}
          options={[
            { value: '', label: T('selectCustomer') },
            ...customers.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      )}

      <Input
        label={T('name')}
        name="name"
        required
        maxLength={100}
        defaultValue={existing?.name ?? ''}
        placeholder={T('namePlaceholder')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label={T('brand')}
          name="brand"
          maxLength={100}
          defaultValue={existing?.brand ?? ''}
        />
        <Input
          label={T('model')}
          name="model"
          maxLength={100}
          defaultValue={existing?.model ?? ''}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label={T('serial')}
          name="serial"
          maxLength={100}
          defaultValue={existing?.serial ?? ''}
        />
        <Input
          label={T('installDate')}
          name="installDate"
          type="date"
          defaultValue={existing?.installDate ?? ''}
        />
      </div>

      {/* D5: optional purchase cost — dollars in the UI, cents in the DB. */}
      <Input
        label={T('purchaseCost')}
        name="purchaseCost"
        type="text"
        inputMode="decimal"
        pattern="[0-9]*\.?[0-9]*"
        placeholder="0.00"
        defaultValue={
          existing?.purchaseCostCents != null
            ? String(centsToDollars(existing.purchaseCostCents))
            : ''
        }
      />

      <Textarea
        label={T('notes')}
        name="notes"
        rows={3}
        maxLength={2000}
        defaultValue={existing?.notes ?? ''}
      />

      {state.error && <p className="text-sm font-medium text-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full inline-flex items-center justify-center rounded-xl bg-asphalt px-4 py-3 text-sm font-semibold text-hero-ink hover:bg-graphite disabled:opacity-50 min-h-[48px]"
      >
        {pending ? '…' : mode === 'create' ? T('save') : T('update')}
      </button>
    </form>
  );
}
