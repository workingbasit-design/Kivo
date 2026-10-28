'use client';

import React, { useActionState } from 'react';
import { Receipt, CheckCircle2, AlertCircle } from '@/components/icons';
import { runScheduledInvoiceGeneration } from '@/app/actions/recurring';

import { useResolvedT } from '@/hooks/useResolvedLocale';
import { Button } from '@/components/kit';

/**
 * Slice 8: "Generate scheduled invoices" button — the manual equivalent of
 * the monthly step the recurring cron runs. Creates DRAFT invoices for
 * due MONTHLY series (previous month, idempotent), then reports how many.
 */
export default function GenerateScheduledInvoicesButton() {
  const [state, formAction, isPending] = useActionState(runScheduledInvoiceGeneration, {});
  const { t } = useResolvedT();

  return (
    <div className="flex flex-col items-end gap-1.5">
      <form action={formAction}>
        <Button type="submit" disabled={isPending} variant="secondary">
          <Receipt size={14} />
          {isPending ? t('t10work.recurSchedGenerating') : t('t10work.recurSchedGenerate')}
        </Button>
      </form>
      {state.ok && (
        <p className="flex items-center gap-1 text-[11px] font-semibold text-ok">
          <CheckCircle2 size={12} />
          {state.created === 0
            ? t('t10work.recurSchedNothingDue')
            : state.created === 1
              ? t('t10work.recurSchedCreatedOne')
              : t('t10work.recurSchedCreatedMany').replace('{n}', String(state.created))}
        </p>
      )}
      {state.error && (
        <p className="flex items-center gap-1 text-[11px] font-semibold text-danger">
          <AlertCircle size={12} />
          {state.error}
        </p>
      )}
    </div>
  );
}
