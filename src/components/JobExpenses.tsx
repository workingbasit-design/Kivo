'use client';

import React, { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { Receipt, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  addExpense,
  deleteExpense,
  type JobOpsActionResult,
} from '@/app/actions/jobops';
import { Card } from '@/components/ui';
import { jInputClass, jPrimaryBtnClass } from '@/components/jobops-classes';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatMoney } from '@/lib/money';
import { toDateInputValue } from '@/lib/timesheets';
import { t, type Locale } from '@/lib/i18n';

export interface ExpenseData {
  id: string;
  description: string;
  amount: number;
  category: string;
  spentAt: string; // ISO date string from the server
}

const CATEGORIES = ['MATERIALS', 'TRAVEL', 'OTHER'] as const;

/** Expenses card for the job detail page. Record-only — never a payment. */
export function JobExpenses({
  jobId,
  expenses,
  locale,
  currency,
}: {
  jobId: string;
  expenses: ExpenseData[];
  locale: Locale;
  currency?: string;
}) {
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <Card className="p-5 md:p-6">
      <h2 className="text-sm font-bold text-ink mb-4 flex items-center gap-2">
        <Receipt size={14} /> {t(locale, 'jobops.expenses.title')}
        <span className="text-[11px] font-semibold text-graphite tabular-nums">
          ({expenses.length})
        </span>
      </h2>

      {expenses.length === 0 ? (
        <p className="text-xs text-graphite py-2">
          {t(locale, 'jobops.expenses.empty')}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-smoke border-t border-smoke">
            {expenses.map((e) => (
              <ExpenseRow key={e.id} expense={e} locale={locale} currency={currency} />
            ))}
          </ul>
          <div className="flex items-center justify-between py-3 text-sm">
            <span className="font-bold text-ink">
              {t(locale, 'jobops.expenses.total')}
            </span>
            <span className="font-bold text-ink tabular-nums">
              {formatMoney(total, currency)}
            </span>
          </div>
        </>
      )}

      <div className="pt-4 border-t border-smoke mt-1">
        <AddExpenseForm jobId={jobId} locale={locale} />
      </div>
    </Card>
  );
}

function ExpenseRow({
  expense,
  locale,
  currency,
}: {
  expense: ExpenseData;
  locale: Locale;
  currency?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const T = (k: string) => t(locale, `t10work.${k}`);

  const runDelete = () => {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const res = await deleteExpense(expense.id);
      if (res?.error) {
        setError(res.error);
        toast.error(T('expenseErrorDelete'));
      } else {
        toast.success(T('expenseDeleted'));
      }
    });
  };

  const catKey =
    expense.category === 'TRAVEL'
      ? 'jobops.expenses.travel'
      : expense.category === 'OTHER'
        ? 'jobops.expenses.other'
        : 'jobops.expenses.materials';

  return (
    <li className="py-2 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink truncate">{expense.description}</p>
        <p className="text-[11px] text-graphite">
          {t(locale, catKey)} · {expense.spentAt}
        </p>
        {error && <p className="text-[11px] text-rose-600 mt-1 font-medium">{error}</p>}
      </div>
      <span className="text-sm font-bold text-ink tabular-nums shrink-0">
        {formatMoney(expense.amount, currency)}
      </span>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={isPending}
        title={t(locale, 'jobops.expenses.delete')}
        aria-label={t(locale, 'jobops.expenses.delete')}
        className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 disabled:opacity-60"
      >
        <Trash2 size={15} />
      </button>
      <ConfirmDialog
        open={confirming}
        title={t(locale, 'jobops.expenses.delete')}
        message={expense.description}
        busy={isPending}
        onConfirm={runDelete}
        onClose={() => setConfirming(false)}
      />
    </li>
  );
}

function AddExpenseForm({ jobId, locale }: { jobId: string; locale: Locale }) {
  const [state, formAction, isPending] = useActionState<JobOpsActionResult, FormData>(
    addExpense,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  const T = (k: string) => t(locale, `t10work.${k}`);
  const toastedFor = useRef<JobOpsActionResult | null>(null);

  useEffect(() => {
    if (state?.ok && toastedFor.current !== state) {
      toastedFor.current = state;
      formRef.current?.reset();
      toast.success(t(locale, 't10work.expenseAdded'));
    }
  }, [state, locale]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-graphite mb-1">
            {t(locale, 'jobops.expenses.description')}
          </label>
          <input
            name="description"
            required
            maxLength={200}
            placeholder={t(locale, 'jobops.expenses.descriptionPlaceholder')}
            className={jInputClass}
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-graphite mb-1">
            {t(locale, 'jobops.expenses.amount')}
          </label>
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            required
            placeholder="0.00"
            className={jInputClass}
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-graphite mb-1">
            {t(locale, 'jobops.expenses.category')}
          </label>
          <select name="category" className={jInputClass} defaultValue="MATERIALS">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(
                  locale,
                  c === 'TRAVEL'
                    ? 'jobops.expenses.travel'
                    : c === 'OTHER'
                      ? 'jobops.expenses.other'
                      : 'jobops.expenses.materials'
                )}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-graphite mb-1">
            {t(locale, 'jobops.expenses.date')}
          </label>
          <input
            name="spentAt"
            type="date"
            required
            defaultValue={toDateInputValue(new Date())}
            className={jInputClass}
          />
        </div>
      </div>
      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      <button type="submit" disabled={isPending} className={jPrimaryBtnClass}>
        {isPending ? '…' : t(locale, 'jobops.expenses.add')}
      </button>
    </form>
  );
}
