'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { HandCoins, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Card, Field, inputClass, primaryBtnClass, secondaryBtnClass, ProgressBar } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { setQuoteDepositAction, recordManualQuoteDepositAction } from '@/app/actions/stripe';

/**
 * Fires a toast exactly once per server-action result. Minimal inline
 * replacement for the removed useActionToast helper.
 */
function useResultToast<T extends { ok?: boolean; error?: string }>(
  state: T | undefined,
  messages: { success?: string; error?: string }
) {
  const seen = useRef<T | undefined>(undefined);
  useEffect(() => {
    if (!state || seen.current === state) return;
    seen.current = state;
    if (state.ok && messages.success) {
      toast.success(messages.success);
    } else if (state.error) {
      toast.error(messages.error ?? state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

type Deposit = {
  id: string;
  amount: number;
  provider: string;
  status: string;
  note: string | null;
  receiptUrl: string | null;
  createdAt: Date | string;
};

/**
 * Owner-side deposit card on the quote detail page: set the required deposit,
 * see online + manual deposits, and record Interac/cash/cheque deposits.
 */
export default function QuoteDepositCard({
  quoteId,
  depositAmount,
  deposits,
  locale,
}: {
  quoteId: string;
  depositAmount: number | null;
  deposits: Deposit[];
  locale: Locale;
}) {
  const [amtState, amtAction] = useActionState(setQuoteDepositAction, {});
  const [recState, recAction] = useActionState(recordManualQuoteDepositAction, {});
  const [showRecord, setShowRecord] = useState(false);

  useResultToast(amtState, {
    success: t(locale, 't10money.depositSaved'),
  });
  useResultToast(recState, {
    success: t(locale, 't10money.depositRecorded'),
  });

  useEffect(() => {
    if (recState?.ok) setShowRecord(false);
  }, [recState]);

  const collected = deposits
    .filter((d) => d.status === 'COMPLETED')
    .reduce((s, d) => s + d.amount, 0);
  const target = depositAmount ?? 0;
  const remaining = Math.max(0, target - collected);

  return (
    <Card className="p-6">
      <h2 className="text-sm font-bold text-zinc-900 mb-1 flex items-center gap-2">
        <HandCoins size={14} className="text-zinc-400" />
        {t(locale, 'payments.depositTitle')}
      </h2>
      <p className="text-xs text-zinc-500 mb-4">{t(locale, 'payments.depositOwnerHint')}</p>

      {target > 0 && (
        <div className="mb-4 rounded-xl bg-zinc-50 border border-zinc-200/70 px-3 py-2.5 text-xs">
          <ProgressBar value={collected} max={target} className="mb-2.5" />
          <div className="flex justify-between font-semibold text-zinc-700">
            <span>{t(locale, 'payments.depositRequired')}</span>
            <span>{formatMoney(target, 'CAD', locale)}</span>
          </div>
          <div className="flex justify-between text-zinc-500 mt-1">
            <span>{t(locale, 'payments.depositCollected')}</span>
            <span>{formatMoney(collected, 'CAD', locale)}</span>
          </div>
          {remaining > 0 && (
            <div className="flex justify-between font-bold text-amber-700 mt-1">
              <span>{t(locale, 'payments.depositRemaining')}</span>
              <span>{formatMoney(remaining, 'CAD', locale)}</span>
            </div>
          )}
        </div>
      )}

      <form action={amtAction} className="flex flex-wrap items-end gap-2 mb-4">
        <input type="hidden" name="quoteId" value={quoteId} />
        <Field label={t(locale, 'payments.depositRequired')}>
          <input
            name="depositAmount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={target > 0 ? target.toFixed(2) : ''}
            placeholder="0.00"
            className={`${inputClass} w-36`}
          />
        </Field>
        <button type="submit" className={secondaryBtnClass}>
          {t(locale, 'messaging.saveSettings')}
        </button>
      </form>
      {amtState.error && <p className="text-xs font-semibold text-rose-600 mb-3">{amtState.error}</p>}

      {deposits.length > 0 && (
        <ul className="space-y-1.5 text-xs mb-4">
          {deposits.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-2 rounded-lg bg-zinc-50 px-2.5 py-1.5">
              <span className="font-bold text-zinc-800">{formatMoney(d.amount, 'CAD', locale)}</span>
              <span className="text-zinc-500">{d.provider}</span>
              <span className={`font-semibold ${d.status === 'FAILED' ? 'text-rose-600' : 'text-emerald-700'}`}>
                {d.status}
              </span>
              {d.note && <span className="text-zinc-400">· {d.note}</span>}
              {d.receiptUrl && (
                <a href={d.receiptUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-semibold">
                  {t(locale, 'payments.receiptLink')}
                </a>
              )}
              <span className="ml-auto text-zinc-400">
                {new Date(d.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA')}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!showRecord ? (
        <button onClick={() => setShowRecord(true)} className={secondaryBtnClass}>
          <Plus size={13} /> {t(locale, 'payments.recordManualDeposit')}
        </button>
      ) : (
        <form action={recAction} className="space-y-3 rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3">
          <input type="hidden" name="quoteId" value={quoteId} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t(locale, 'payments.colAmount')}>
              <input name="amount" type="number" min="0.01" step="0.01" required className={inputClass} />
            </Field>
            <Field label={t(locale, 'payments.colMethod')}>
              <select name="provider" required className={inputClass} defaultValue="">
                <option value="" disabled>
                  {t(locale, 'payments.chooseMethod')}
                </option>
                <option value="INTERAC">{t(locale, 'payments.methodInterac')}</option>
                <option value="CASH">{t(locale, 'payments.methodCash')}</option>
                <option value="CHEQUE">{t(locale, 'payments.methodCheque')}</option>
              </select>
            </Field>
          </div>
          <Field label={t(locale, 'payments.noteOptional')}>
            <input name="note" className={inputClass} maxLength={120} />
          </Field>
          {recState.error && <p className="text-xs font-semibold text-rose-600">{recState.error}</p>}
          <div className="flex gap-2">
            <button type="submit" className={primaryBtnClass}>
              {t(locale, 'payments.recordDepositButton')}
            </button>
            <button type="button" onClick={() => setShowRecord(false)} className={secondaryBtnClass}>
              {t(locale, 'payments.cancel')}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
