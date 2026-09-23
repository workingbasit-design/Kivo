'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, Flag } from 'lucide-react';
import { reportBusiness, type DirectoryActionResult } from '@/app/actions/directory';
import { useResolvedT } from '@/hooks/useResolvedLocale';

const REASONS = [
  { value: 'spam', key: 't10misc.directory.reportReasonSpam' },
  { value: 'fake-listing', key: 't10misc.directory.reportReasonFake' },
  { value: 'wrong-info', key: 't10misc.directory.reportReasonWrongInfo' },
  { value: 'rude-behaviour', key: 't10misc.directory.reportReasonRude' },
  { value: 'other', key: 't10misc.directory.reportReasonOther' },
];

const fieldClass =
  'w-full min-h-[44px] rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none focus:border-ink';

export default function ReportBusinessForm({ slug }: { slug: string }) {
  const { t } = useResolvedT();
  const [state, formAction, isPending] = useActionState<DirectoryActionResult, FormData>(
    reportBusiness,
    {}
  );

  if (state?.ok) {
    return (
      <div
        role="status"
        className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl px-3 py-2.5"
      >
        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
        <span>{t('t10misc.directory.reportThanks')}</span>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2.5">
      <input type="hidden" name="slug" value={slug} />
      <div>
        <label htmlFor="report-reason" className="block text-xs font-bold text-zinc-700 mb-1">
          {t('t10misc.directory.reportReason')}
        </label>
        <select
          id="report-reason"
          name="reason"
          required
          defaultValue="spam"
          className={fieldClass}
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {t(r.key)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="report-details" className="sr-only">
          {t('t10misc.directory.reportDetailsPlaceholder')}
        </label>
        <textarea
          id="report-details"
          name="details"
          rows={2}
          maxLength={1000}
          placeholder={t('t10misc.directory.reportDetailsPlaceholder')}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="report-contact" className="sr-only">
          {t('t10misc.directory.reportContactPlaceholder')}
        </label>
        <input
          id="report-contact"
          name="reporterContact"
          type="text"
          maxLength={120}
          placeholder={t('t10misc.directory.reportContactPlaceholder')}
          className={fieldClass}
        />
      </div>
      {state?.error && (
        <div
          role="alert"
          className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5"
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1.5 min-h-[44px] rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-bold px-4 py-2.5 transition-colors disabled:opacity-60"
      >
        <Flag size={12} /> {isPending ? t('t10misc.directory.reportSending') : t('t10misc.directory.reportSubmit')}
      </button>
    </form>
  );
}
