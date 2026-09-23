'use client';

import { useActionState, useState } from 'react';
import { HandCoins, Plus } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { Card, Field, inputClass, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { recordQuoteDeposit, type ActionResult } from '@/app/actions/quotes';

/**
 * Record a deposit the owner collected outside EveryJob (Interac e-Transfer,
 * cash, cheque). Record-keeping only — no money moves through EveryJob.
 * maxAmount is the quote total; deposits above it are rejected server-side.
 */
export default function RecordDepositForm({
  quoteId,
  locale,
  maxAmount,
}: {
  quoteId: string;
  locale: Locale;
  maxAmount: number;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    recordQuoteDeposit,
    {}
  );
  const [open, setOpen] = useState(false);

  const providers = [
    { value: 'INTERAC', label: t(locale, 'quoteItems.deposit.interac') },
    { value: 'CASH', label: t(locale, 'quoteItems.deposit.cash') },
    { value: 'CHEQUE', label: t(locale, 'quoteItems.deposit.cheque') },
  ];

  return (
    <Card className="p-6">
      <h2 className="text-sm font-bold text-zinc-900 mb-1 flex items-center gap-2">
        <HandCoins size={14} className="text-zinc-400" />
        {t(locale, 'quoteItems.deposit.title')}
      </h2>
      <p className="text-xs text-zinc-500 mb-4">{t(locale, 'quoteItems.deposit.hint')}</p>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={secondaryBtnClass}>
          <Plus size={13} /> {t(locale, 'quoteItems.deposit.record')}
        </button>
      ) : (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="quoteId" value={quoteId} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t(locale, 'quoteItems.deposit.amount')}>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                max={maxAmount}
                required
                placeholder="0.00"
                className={inputClass}
              />
            </Field>
            <Field label={t(locale, 'quoteItems.deposit.provider')}>
              <select name="provider" required className={inputClass} defaultValue="">
                <option value="" disabled>
                  {t(locale, 'quoteItems.deposit.provider')}
                </option>
                {providers.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t(locale, 'quoteItems.deposit.note')}>
            <input name="note" maxLength={500} className={inputClass} />
          </Field>
          <p className="text-[11px] text-zinc-400">
            {t(locale, 'quoteItems.deposit.amount')} ≤ {formatMoney(maxAmount, 'CAD', locale)}
          </p>
          {state?.error && (
            <p className="text-xs font-semibold text-rose-600">{state.error}</p>
          )}
          {state?.ok && (
            <p className="text-xs font-semibold text-emerald-700">
              {t(locale, 'quoteItems.deposit.recorded')}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={isPending} className={primaryBtnClass}>
              {isPending ? t(locale, 'quoteItems.saving') : t(locale, 'quoteItems.deposit.record')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={secondaryBtnClass}
            >
              {t(locale, 'quoteItems.deposit.cancel')}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
