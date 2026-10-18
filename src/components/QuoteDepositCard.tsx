'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { HandCoins, Plus } from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Button, Card, Input, Select } from '@/components/kit';
import { formatMoney } from '@/lib/money';
import { setQuoteDepositAction, recordManualQuoteDepositAction, type ActionResult } from '@/app/actions/stripe';

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
  const [showRecord, setShowRecord] = useState(false);
  // B10.4 double-submit protection: both submit buttons disable while pending.
  const [amtState, amtAction, amtPending] = useActionState(setQuoteDepositAction, {});
  // Wrap so the record form closes on success in the submission handler
  // (user-initiated) instead of syncing via an effect.
  const [recState, recAction, recPending] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const result = await recordManualQuoteDepositAction(prev, formData);
      if (result?.ok) setShowRecord(false);
      return result;
    },
    {}
  );

  // (Record-form tidy-up now happens in the action wrapper above.)

  useResultToast(amtState, {
    success: t(locale, 't10money.depositSaved'),
  });
  useResultToast(recState, {
    success: t(locale, 't10money.depositRecorded'),
  });

  const collected = deposits
    .filter((d) => d.status === 'COMPLETED')
    .reduce((s, d) => s + d.amount, 0);
  const target = depositAmount ?? 0;
  const remaining = Math.max(0, target - collected);

  return (
    <Card className="p-6">
      <h2 className="text-sm font-bold text-ink mb-1 flex items-center gap-2">
        <HandCoins size={14} className="text-ink-2" />
        {t(locale, 'payments.depositTitle')}
      </h2>
      <p className="text-xs text-ink-2 mb-4">{t(locale, 'payments.depositOwnerHint')}</p>

      {target > 0 && (
        <div className="mb-4 rounded-xl bg-surface-2 border border-line/70 px-3 py-2.5 text-xs">
          {/* Deposit-collection progress (kit has no generic bar; token
              track + fill keep the old ProgressBar's look). */}
          <div
            role="progressbar"
            aria-valuenow={Math.round(Math.max(0, Math.min(100, (collected / target) * 100)))}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mb-2.5 h-2 rounded-full bg-surface-2 overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-asphalt transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, (collected / target) * 100))}%` }}
            />
          </div>
          <div className="flex justify-between font-semibold text-ink">
            <span>{t(locale, 'payments.depositRequired')}</span>
            <span>{formatMoney(target, 'CAD', locale)}</span>
          </div>
          <div className="flex justify-between text-ink-2 mt-1">
            <span>{t(locale, 'payments.depositCollected')}</span>
            <span>{formatMoney(collected, 'CAD', locale)}</span>
          </div>
          {remaining > 0 && (
            <div className="flex justify-between font-bold text-warn-text mt-1">
              <span>{t(locale, 'payments.depositRemaining')}</span>
              <span>{formatMoney(remaining, 'CAD', locale)}</span>
            </div>
          )}
        </div>
      )}

      <form action={amtAction} className="flex flex-wrap items-end gap-2 mb-4">
        <input type="hidden" name="quoteId" value={quoteId} />
        <Input
          label={t(locale, 'payments.depositRequired')}
          name="depositAmount"
          type="text"
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          defaultValue={target > 0 ? target.toFixed(2) : ''}
          placeholder="0.00"
          className="w-36"
        />
        <Button type="submit" variant="secondary" disabled={amtPending} className="mb-[18px]">
          {t(locale, 'messaging.saveSettings')}
        </Button>
      </form>
      {amtState.error && <p className="text-xs font-semibold text-danger mb-3">{amtState.error}</p>}

      {deposits.length > 0 && (
        <ul className="space-y-1.5 text-xs mb-4">
          {deposits.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-2 rounded-lg bg-surface-2 px-2.5 py-1.5">
              <span className="font-bold text-ink">{formatMoney(d.amount, 'CAD', locale)}</span>
              <span className="text-ink-2">{d.provider}</span>
              <span className={`font-semibold ${d.status === 'FAILED' ? 'text-danger' : 'text-ok'}`}>
                {d.status}
              </span>
              {d.note && <span className="text-ink-2">· {d.note}</span>}
              {d.receiptUrl && (
                <a href={d.receiptUrl} target="_blank" rel="noreferrer" className="text-info hover:underline font-semibold">
                  {t(locale, 'payments.receiptLink')}
                </a>
              )}
              <span className="ml-auto text-ink-2">
                {new Date(d.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA')}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!showRecord ? (
        <Button type="button" variant="secondary" onClick={() => setShowRecord(true)}>
          <Plus size={13} /> {t(locale, 'payments.recordManualDeposit')}
        </Button>
      ) : (
        <form action={recAction} className="space-y-3 rounded-xl border border-line/70 bg-surface-2/60 p-3">
          <input type="hidden" name="quoteId" value={quoteId} />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t(locale, 'payments.colAmount')}
              name="amount"
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              required
            />
            <Select
              label={t(locale, 'payments.colMethod')}
              name="provider"
              required
              defaultValue=""
              options={[
                { value: '', label: t(locale, 'payments.chooseMethod'), disabled: true },
                { value: 'INTERAC', label: t(locale, 'payments.methodInterac') },
                { value: 'CASH', label: t(locale, 'payments.methodCash') },
                { value: 'CHEQUE', label: t(locale, 'payments.methodCheque') },
              ]}
            />
          </div>
          <Input
            label={t(locale, 'payments.noteOptional')}
            name="note"
            maxLength={120}
          />
          {recState.error && <p className="text-xs font-semibold text-danger">{recState.error}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={recPending}>
              {t(locale, 'payments.recordDepositButton')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowRecord(false)}>
              {t(locale, 'payments.cancel')}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
