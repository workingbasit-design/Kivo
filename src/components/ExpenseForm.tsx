'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Receipt, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  createExpense,
  updateExpense,
  type ExpenseResult,
} from '@/app/actions/expenses';
import {
  Field,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
  Card,
} from '@/components/ui';
import { EXPENSE_CATEGORIES } from '@/lib/expenses';
import { formatDateShort } from '@/lib/utils';
import { t, type Locale } from '@/lib/i18n';

export interface ExpenseFormJob {
  id: string;
  title: string;
  date: string; // ISO
}

export interface ExpenseFormInitial {
  id: string;
  description: string;
  amount: number;
  category: string;
  spentAt: string; // YYYY-MM-DD
  jobId: string | null;
  note: string | null;
  receiptUrl: string | null;
}

/** Shared create/edit form for standalone expense tracking. */
export default function ExpenseForm({
  locale,
  jobs,
  initial,
}: {
  locale: Locale;
  jobs: ExpenseFormJob[];
  initial?: ExpenseFormInitial;
}) {
  const T = (k: string) => t(locale, `expenses.${k}` as never);
  const isEdit = !!initial;

  const [state, formAction, isPending] = useActionState<ExpenseResult | null, FormData>(
    isEdit
      ? (_prev: ExpenseResult | null, fd: FormData) => updateExpense(initial.id, fd)
      : (_prev: ExpenseResult | null, fd: FormData) => createExpense(fd),
    null
  );
  const seen = useRef<ExpenseResult | null | undefined>(undefined);
  useEffect(() => {
    if (!state || seen.current === state) return;
    seen.current = state;
    if (state.ok) {
      toast.success(T(isEdit ? 'updated' : 'created'));
    } else if (state.error === 'validation' && state.errorKey) {
      toast.error(t(locale, state.errorKey as never));
    } else {
      const map: Record<string, string> = {
        rateLimited: 'errors.tooManyRequests',
        notFound: 'errors.notFound',
        jobNotFound: 'errors.notFound',
        receiptBadType: 'receiptBadType',
        receiptTooLarge: 'receiptTooLarge',
        uploadFailed: 'errors.uploadFailed',
        notConfigured: 'errors.uploadFailed',
      };
      const key = map[state.error ?? ''] ?? 'errors.uploadFailed';
      toast.error(key.startsWith('expenses.') ? T(key.slice(9)) : t(locale, key as never));
    }
  }, [state, isEdit, locale, T]);

  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="space-y-5">
      <Card className="p-5 md:p-6 space-y-5">
        <Field label={T('description')}>
          <input
            name="description"
            required
            maxLength={200}
            defaultValue={initial?.description ?? ''}
            placeholder={T('descriptionPlaceholder')}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={T('amount')}>
            <input
              name="amount"
              type="number"
              required
              min="0.01"
              step="0.01"
              inputMode="decimal"
              defaultValue={initial ? String(initial.amount) : ''}
              placeholder="0.00"
              className={inputClass}
            />
          </Field>
          <Field label={T('date')}>
            <input
              name="spentAt"
              type="date"
              required
              defaultValue={initial?.spentAt ?? new Date().toISOString().slice(0, 10)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={T('category')}>
            <select
              name="category"
              required
              defaultValue={initial?.category ?? 'MATERIALS'}
              className={inputClass}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {T(`categories.${c}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={T('job')}>
            <select name="jobId" defaultValue={initial?.jobId ?? ''} className={inputClass}>
              <option value="">{T('noJob')}</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} - {formatDateShort(j.date, locale)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={T('note')}>
          <textarea
            name="note"
            rows={3}
            maxLength={1000}
            defaultValue={initial?.note ?? ''}
            placeholder={T('notePlaceholder')}
            className={inputClass}
          />
        </Field>

        <Field label={T('receipt')}>
          {initial?.receiptUrl && !removeReceipt ? (
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={initial.receiptUrl}
                alt={T('receipt')}
                className="h-16 w-16 rounded-lg object-cover border border-zinc-200"
              />
              <div className="flex-1 min-w-0">
                <a
                  href={initial.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-ink hover:underline"
                >
                  {T('receiptView')}
                </a>
                <p className="text-xs text-zinc-500">{T('receiptHint')}</p>
              </div>
              <button
                type="button"
                onClick={() => setRemoveReceipt(true)}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-200"
                aria-label={T('receiptRemove')}
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-3 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-4 cursor-pointer hover:border-zinc-300 transition-colors">
              <Receipt size={20} className="text-zinc-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-zinc-700">
                  {receiptName ?? T('receipt')}
                </span>
                <p className="text-xs text-zinc-500">{T('receiptHint')}</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                name="receipt"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="sr-only"
                onChange={(e) => setReceiptName(e.target.files?.[0]?.name ?? null)}
              />
            </label>
          )}
          {removeReceipt && <input type="hidden" name="removeReceipt" value="1" />}
        </Field>
      </Card>

      <div className="flex gap-3">
        <button type="submit" disabled={isPending} className={primaryBtnClass}>
          {T(isEdit ? 'update' : 'create')}
        </button>
        <Link href="/expenses" className={secondaryBtnClass}>
          {T('back')}
        </Link>
      </div>
    </form>
  );
}
