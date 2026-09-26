'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Clock, MessageSquareQuote, Send } from 'lucide-react';
import { submitQuoteRequest, type DirectoryActionResult } from '@/app/actions/directory';
import { useResolvedT } from '@/hooks/useResolvedLocale';

const inputClass =
  'w-full min-h-[44px] rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none focus:border-ink';

export default function QuoteRequestForm() {
  const { t } = useResolvedT();
  const [state, formAction, isPending] = useActionState<DirectoryActionResult, FormData>(
    submitQuoteRequest,
    {}
  );
  const v = state?.values;

  const labelClass = 'block text-xs font-bold text-zinc-700 mb-1';

  // Matched: request landed in provider inboxes.
  if (state?.ok && !state.unmatched) {
    return (
      <div className="bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-6 md:p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900">{t('t10misc.directory.qrSentTitle')}</h2>
        <p className="text-sm text-zinc-500 mt-1">{t('t10misc.directory.qrSentSubtitle')}</p>
        <ul className="mt-3 space-y-1.5">
          {(state.businessNames ?? []).map((n) => (
            <li key={n} className="text-sm font-semibold text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2">
              {n}
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-400 mt-4">{t('t10misc.directory.qrSentNote')}</p>
        <Link
          href="/directory"
          className="inline-flex items-center justify-center min-h-[44px] mt-4 text-sm font-bold text-ink hover:underline px-3"
        >
          ← {t('t10misc.directory.backToDirectory')}
        </Link>
      </div>
    );
  }

  // Unmatched: request saved as an open lead draft — nothing was dropped.
  if (state?.ok && state.unmatched) {
    return (
      <div className="bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-6 md:p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-6 h-6 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900">{t('t10misc.directory.qrSavedTitle')}</h2>
        <p className="text-sm text-zinc-600 mt-2 max-w-md mx-auto leading-relaxed">
          {t('t10misc.directory.qrSavedBody').replaceAll('{city}', state.city ?? '')}
        </p>
        <div className="mt-4 bg-paper border border-smoke rounded-xl px-4 py-3 text-xs text-zinc-600">
          {t('t10misc.directory.qrSavedTip')}
        </div>
        <div className="mt-5 flex items-center justify-center gap-4">
          <Link href="/directory" className="inline-flex items-center min-h-[44px] text-sm font-bold text-ink hover:underline px-3">
            ← {t('t10misc.directory.backToDirectory')}
          </Link>
          <Link
            href="/directory/request"
            className="inline-flex items-center min-h-[44px] text-sm font-bold text-zinc-600 hover:text-zinc-900 hover:underline px-3"
          >
            {t('t10misc.directory.qrAnother')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      key={state?.values ? 'retry' : 'fresh'}
      action={formAction}
      className="bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-6 md:p-8 space-y-4"
    >
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-10 h-10 rounded-xl bg-smoke flex items-center justify-center">
          <MessageSquareQuote className="w-5 h-5 text-ink" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-900 tracking-tight">{t('t10misc.directory.qrTitle')}</h1>
          <p className="text-xs text-zinc-500">{t('t10misc.directory.qrSubtitle')}</p>
        </div>
      </div>

      <div>
        <label htmlFor="qr-service" className={labelClass}>
          {t('t10misc.directory.qrService')}
        </label>
        <input
          id="qr-service"
          name="serviceNeed"
          required
          minLength={3}
          maxLength={200}
          defaultValue={v?.serviceNeed ?? ''}
          placeholder={t('t10misc.directory.qrServicePlaceholder')}
          className={inputClass}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="qr-city" className={labelClass}>
            {t('t10misc.directory.qrCity')}
          </label>
          <input
            id="qr-city"
            name="city"
            required
            minLength={2}
            maxLength={100}
            defaultValue={v?.city ?? ''}
            placeholder={t('t10misc.directory.qrCityPlaceholder')}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="qr-area" className={labelClass}>
            {t('t10misc.directory.qrArea')}{' '}
            <span className="font-normal text-zinc-400">{t('t10misc.directory.qrOptional')}</span>
          </label>
          <input
            id="qr-area"
            name="area"
            maxLength={100}
            defaultValue={v?.area ?? ''}
            placeholder={t('t10misc.directory.qrAreaPlaceholder')}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="qr-details" className={labelClass}>
          {t('t10misc.directory.qrDetails')}{' '}
          <span className="font-normal text-zinc-400">{t('t10misc.directory.qrOptional')}</span>
        </label>
        <textarea
          id="qr-details"
          name="details"
          rows={3}
          maxLength={1000}
          defaultValue={v?.details ?? ''}
          placeholder={t('t10misc.directory.qrDetailsPlaceholder')}
          className={inputClass}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="qr-name" className={labelClass}>
            {t('t10misc.directory.qrName')}
          </label>
          <input
            id="qr-name"
            name="name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={v?.name ?? ''}
            placeholder={t('t10misc.directory.qrNamePlaceholder')}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="qr-phone" className={labelClass}>
            {t('t10misc.directory.qrPhone')}
          </label>
          <input
            id="qr-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            maxLength={25}
            defaultValue={v?.phone ?? ''}
            placeholder={t('t10misc.directory.qrPhonePlaceholder')}
            className={inputClass}
          />
          <p className="text-[11px] text-zinc-400 mt-1">{t('t10misc.directory.qrPhoneHint')}</p>
        </div>
      </div>

      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5" role="alert">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-ink hover:bg-graphite text-white text-sm font-bold px-5 py-3 transition-colors disabled:opacity-60"
      >
        <Send size={15} /> {isPending ? t('t10misc.directory.qrSending') : t('t10misc.directory.qrSubmit')}
      </button>
      <p className="text-[11px] text-zinc-400 text-center">{t('t10misc.directory.qrFootnote')}</p>
    </form>
  );
}
