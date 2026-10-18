'use client';

import { useActionState, useState } from 'react';
import { HandCoins, Plus } from '@/components/icons';
import { t, type Locale } from '@/lib/i18n';
import { Button, Card, Input, Select } from '@/components/kit';
import { formatMoney } from '@/lib/money';
import { recordQuoteDeposit, type ActionResult } from '@/app/actions/quotes';

/**
 * Record a deposit the owner collected outside EveryJob (Interac e-Transfer,
 * cash, cheque). Record-keeping only - no money moves through EveryJob.
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
      <h2 className="text-sm font-bold text-ink mb-1 flex items-center gap-2">
        <HandCoins size={14} className="text-ink-2" />
        {t(locale, 'quoteItems.deposit.title')}
      </h2>
      <p className="text-xs text-ink-2 mb-4">{t(locale, 'quoteItems.deposit.hint')}</p>

      {!open ? (
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          <Plus size={13} /> {t(locale, 'quoteItems.deposit.record')}
        </Button>
      ) : (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="quoteId" value={quoteId} />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t(locale, 'quoteItems.deposit.amount')}
              name="amount"
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              required
              placeholder="0.00"
            />
            <Select
              label={t(locale, 'quoteItems.deposit.provider')}
              name="provider"
              required
              defaultValue=""
              options={[
                { value: '', label: t(locale, 'quoteItems.deposit.provider'), disabled: true },
                ...providers.map((p) => ({ value: p.value, label: p.label })),
              ]}
            />
          </div>
          <Input
            label={t(locale, 'quoteItems.deposit.note')}
            name="note"
            maxLength={500}
          />
          <p className="text-[11px] text-ink-2">
            {t(locale, 'quoteItems.deposit.amount')} ≤ {formatMoney(maxAmount, 'CAD', locale)}
          </p>
          {state?.error && (
            <p className="text-xs font-semibold text-danger">{state.error}</p>
          )}
          {state?.ok && (
            <p className="text-xs font-semibold text-ok">
              {t(locale, 'quoteItems.deposit.recorded')}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? t(locale, 'quoteItems.saving') : t(locale, 'quoteItems.deposit.record')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              {t(locale, 'quoteItems.deposit.cancel')}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
