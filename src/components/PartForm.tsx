'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { t, type Locale } from '@/lib/i18n';
import { Button, Input, Textarea } from '@/components/kit';
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
          label={T('sku')}
          name="sku"
          maxLength={50}
          defaultValue={existing?.sku ?? ''}
        />
        <Input
          label={T('unit')}
          name="unit"
          maxLength={20}
          defaultValue={existing?.unit ?? ''}
          placeholder={T('unitPlaceholder')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label={T('quantity')}
          name="quantity"
          type="number"
          min={0}
          step="any"
          defaultValue={existing?.quantity ?? 0}
        />
        <Input
          label={T('reorderPoint')}
          hint={T('reorderPointHint')}
          name="reorderPoint"
          type="number"
          min={0}
          step="any"
          defaultValue={existing?.reorderPoint ?? ''}
        />
      </div>

      <Input
        label={T('unitCost')}
        name="unitCost"
        type="text"
        inputMode="decimal"
        pattern="[0-9]*\.?[0-9]*"
        defaultValue={existing?.unitCost ?? ''}
      />

      <Textarea
        label={T('notes')}
        name="notes"
        rows={3}
        maxLength={2000}
        defaultValue={existing?.notes ?? ''}
      />

      {state.error && <p className="text-sm font-medium text-danger">{state.error}</p>}

      <Button
        variant="primary"
        type="submit"
        block
        disabled={pending}
        className="disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? '…' : mode === 'create' ? T('save') : T('update')}
      </Button>
    </form>
  );
}
