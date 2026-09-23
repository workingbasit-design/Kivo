'use client';

import { useActionState } from 'react';
import { AlertCircle, Phone } from 'lucide-react';
import { saveWelcomePhone, skipWelcomePhone } from '@/app/actions/auth';
import { t, type Locale } from '@/lib/i18n';

/**
 * Welcome contact-number form: Canadian number (validated server-side)
 * or an explicit skip. Both mark the prompt as shown.
 */
export default function WelcomeClient({
  locale,
  userName,
}: {
  locale: Locale;
  userName: string | null;
}) {
  const [state, formAction, isPending] = useActionState(saveWelcomePhone, {});

  return (
    <div>
      {userName && (
        <p className="text-sm font-semibold text-zinc-900 mb-4">
          {userName}
        </p>
      )}
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="phone" className="block text-xs font-semibold text-zinc-700 mb-1.5">
            {t(locale, 'googleAuth.phoneLabel')}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder={t(locale, 'googleAuth.phonePlaceholder')}
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ink/30 focus:border-ink"
          />
          <p className="text-[11px] text-zinc-400 mt-1.5">{t(locale, 'googleAuth.phoneHint')}</p>
        </div>

        {state?.error && (
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-ink hover:bg-graphite disabled:opacity-60 text-white font-semibold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Phone size={16} />
          {isPending ? '…' : t(locale, 'googleAuth.saveAndContinue')}
        </button>
      </form>

      <form action={skipWelcomePhone} className="mt-3">
        <button
          type="submit"
          className="w-full text-center text-xs font-semibold text-zinc-500 hover:text-zinc-800 py-2"
        >
          {t(locale, 'googleAuth.skipForNow')}
        </button>
      </form>
    </div>
  );
}
