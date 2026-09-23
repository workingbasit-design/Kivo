'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, UserRound } from 'lucide-react';
import { updateProfile } from '@/app/actions/auth';
import { t, type Locale } from '@/lib/i18n';

/**
 * "Your account" card: the signed-in user's own name + Canadian contact
 * number (editable anytime), plus which sign-in method is linked.
 */
export default function ProfileForm({
  locale,
  initial,
}: {
  locale: Locale;
  initial: { name: string; email: string; phone: string; googleLinked: boolean };
}) {
  const [state, formAction, isPending] = useActionState(updateProfile, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="profile-name" className="block text-xs font-semibold text-zinc-700 mb-1.5">
            {t(locale, 'googleAuth.nameLabel')}
          </label>
          <input
            id="profile-name"
            name="name"
            type="text"
            autoComplete="name"
            defaultValue={initial.name}
            placeholder={initial.name || '—'}
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ink/30 focus:border-ink"
          />
        </div>
        <div>
          <label htmlFor="profile-phone" className="block text-xs font-semibold text-zinc-700 mb-1.5">
            {t(locale, 'googleAuth.phoneLabel')}
          </label>
          <input
            id="profile-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            defaultValue={initial.phone}
            placeholder={t(locale, 'googleAuth.phonePlaceholder')}
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ink/30 focus:border-ink"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <UserRound size={13} className="shrink-0" />
        <span>
          {t(locale, 'googleAuth.signInMethod')}: {initial.email} ·{' '}
          {initial.googleLinked
            ? t(locale, 'googleAuth.signInMethodGoogle')
            : t(locale, 'googleAuth.signInMethodPassword')}
        </span>
      </div>
      {initial.googleLinked && (
        <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5">
          <CheckCircle2 size={13} /> {t(locale, 'googleAuth.googleLinked')}
        </p>
      )}

      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state?.ok && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          <span>{t(locale, 'googleAuth.profileSaved')}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="bg-ink hover:bg-graphite disabled:opacity-60 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
      >
        {isPending ? '…' : t(locale, 'googleAuth.save')}
      </button>
    </form>
  );
}
