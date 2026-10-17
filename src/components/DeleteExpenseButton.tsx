'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from '@/components/icons';
import { toast } from 'sonner';
import { deleteExpense } from '@/app/actions/expenses';
import ConfirmDialog from '@/components/ConfirmDialog';
import { t, type Locale } from '@/lib/i18n';

/** Delete button with confirm dialog for the expense detail page. */
export default function DeleteExpenseButton({
  id,
  locale,
}: {
  id: string;
  locale: Locale;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const T = (k: string) => t(locale, `expenses.${k}` as never);

  const doDelete = () => {
    startTransition(async () => {
      const res = await deleteExpense(id);
      if (res.ok) {
        toast.success(T('deleted'));
        router.push('/expenses');
      } else {
        toast.error(t(locale, 'errors.somethingWentWrong'));
        setConfirming(false);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-[44px] px-4 rounded-xl text-sm font-semibold text-danger border border-red-200 bg-surface hover:bg-danger-bg inline-flex items-center gap-2 transition-colors"
      >
        <Trash2 size={16} /> {T('delete')}
      </button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={doDelete}
        title={T('delete')}
        message={T('deleteConfirm')}
        busy={isPending}
        danger
        locale={locale}
      />
    </>
  );
}
