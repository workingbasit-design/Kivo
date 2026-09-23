'use client';

import React, { useActionState } from 'react';
import { Wand2, CheckCircle2, AlertCircle } from 'lucide-react';
import { runRecurringGeneration } from '@/app/actions/recurring';
import { secondaryBtnClass } from '@/components/ui';
import { useResolvedT } from '@/hooks/useResolvedLocale';

/**
 * "Generate due jobs" button. Tapping it creates SCHEDULED jobs for every
 * active recurring plan whose next run is due, then reports how many were
 * created. No cron — the business runs this when they want.
 */
export default function GenerateDueJobsButton() {
  const [state, formAction, isPending] = useActionState(runRecurringGeneration, {});
  const { t } = useResolvedT();

  return (
    <div className="flex flex-col items-end gap-1.5">
      <form action={formAction}>
        <button type="submit" disabled={isPending} className={secondaryBtnClass}>
          <Wand2 size={14} />
          {isPending ? t('t10work.recurGenerating') : t('t10work.recurGenerate')}
        </button>
      </form>
      {state.ok && (
        <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
          <CheckCircle2 size={12} />
          {state.created === 0
            ? t('t10work.recurNothingDue')
            : state.created === 1
              ? t('t10work.recurCreatedOne')
              : t('t10work.recurCreatedMany').replace('{n}', String(state.created))}
        </p>
      )}
      {state.error && (
        <p className="flex items-center gap-1 text-[11px] font-semibold text-red-600">
          <AlertCircle size={12} />
          {state.error}
        </p>
      )}
    </div>
  );
}
