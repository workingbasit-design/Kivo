'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import ConfirmDialog from '@/components/ConfirmDialog';
import { deletePart } from '@/app/actions/inventory';

/** Delete button with confirmation dialog — no silent destructive actions. */
export default function DeletePartButton({
  id,
  locale,
}: {
  id: string;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const T = (k: string) => t(locale, `inventory.${k}`);

  const onDelete = () => {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const res = await deletePart(id);
      if (res.ok) {
        window.location.href = '/inventory';
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
        onClick={() => setConfirming(true)}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40 min-h-[44px]"
      >
        <Trash2 size={16} /> {pending ? '…' : T('delete')}
      </button>
      <ConfirmDialog
        open={confirming}
        title={T('deleteConfirmTitle')}
        message={T('deleteConfirm')}
        busy={pending}
        onConfirm={onDelete}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
