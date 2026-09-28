'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { deletePart } from '@/app/actions/inventory';

/** Delete button with a native confirm step — no silent destructive actions. */
export default function DeletePartButton({
  id,
  locale,
}: {
  id: string;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const T = (k: string) => t(locale, `inventory.${k}`);

  const onDelete = () => {
    if (!window.confirm(T('deleteConfirm'))) return;
    setError(null);
    startTransition(async () => {
      const res = await deletePart(id);
      if (res.ok) {
        router.push('/inventory');
        router.refresh();
      } else {
        setError(res.error ?? T('deleteFailed'));
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {error && (
        <p role="alert" className="text-xs font-medium text-rose-600">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40 min-h-[44px]"
      >
        <Trash2 size={16} /> {pending ? '…' : T('delete')}
      </button>
    </div>
  );
}
