'use client';

import { useActionState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, UserRound } from '@/components/icons';
import { toast } from 'sonner';
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

  useEffect(() => {
    if (state?.ok) toast.success(t(locale, 'googleAuth.profileSaved'));
    else if (state?.error) toast.error(state.error);
  }, [state, locale]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="profile-name" className="block text-xs font-semibold text-ink mb-1.5">
            {t(locale, 'googleAuth.nameLabel')}
          </label>
          <input
            id="profile-name"
            name="name"
            type="text"
            autoComplete="name"
            defaultValue={initial.name}
            placeholder={initial.name || '-'}
            className="w-full px-4 py-2.5 rounded-xl border border-line bg-surface-2 text-sm text-ink placeholder:text-ink-2 focus:outline-none focus:ring-2 focus:ring-ink/30 focus:border-asphalt"
          />
        </div>
        <div>
          <label htmlFor="profile-phone" className="block text-xs font-semibold text-ink mb-1.5">
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
            className="w-full px-4 py-2.5 rounded-xl border border-line bg-surface-2 text-sm text-ink placeholder:text-ink-2 focus:outline-none focus:ring-2 focus:ring-ink/30 focus:border-asphalt"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-ink-2">
        <UserRound size={13} className="shrink-0" />
        <span>
          {t(locale, 'googleAuth.signInMethod')}: {initial.email} ·{' '}
          {initial.googleLinked
            ? t(locale, 'googleAuth.signInMethodGoogle')
            : t(locale, 'googleAuth.signInMethodPassword')}
        </span>
      </div>
      {initial.googleLinked && (
        <p className="text-[11px] text-ok font-medium flex items-center gap-1.5">
          <CheckCircle2 size={13} /> {t(locale, 'googleAuth.googleLinked')}
        </p>
      )}

      {state?.error && (
        <div className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state?.ok && (
        <div className="flex items-start gap-2 bg-ok-bg border border-line text-ok text-xs font-medium rounded-xl px-3 py-2.5">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          <span>{t(locale, 'googleAuth.profileSaved')}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-[44px] inline-flex items-center justify-center w-full sm:w-auto bg-asphalt hover:bg-graphite disabled:opacity-60 text-hero-ink font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
      >
        {isPending ? '…' : t(locale, 'googleAuth.save')}
      </button>
    </form>
  );
}
