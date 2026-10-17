"use client";

import React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { KeyRound, AlertCircle, CheckCircle2 } from '@/components/icons';
import { resetPassword } from '@/app/actions/password-reset';
import { useT } from '@/components/LanguageToggle';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';

export default function ResetPasswordForm({ token }: { token: string }) {
  const { t } = useT();
  const [state, formAction, isPending] = useActionState(resetPassword, {});

  return (
    <div className="bg-surface rounded-3xl border border-line/70 shadow-xl shadow-zinc-200/50 p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        {t('t10misc.auth.resetTitle')}
      </h1>
      <p className="text-sm text-ink-2 mt-1 mb-6">{t('t10misc.auth.resetSubtitle')}</p>

      {state?.ok ? (
        <div className="space-y-4">
          <div
            role="status"
            className="flex items-start gap-2 bg-ok-bg border border-emerald-200 text-emerald-800 text-sm rounded-xl px-3 py-3"
          >
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>{t('t10misc.auth.resetDone')}</span>
          </div>
          <Link href="/login" className={`${primaryBtnClass} w-full`}>
            {t('t10misc.auth.loginLink')}
          </Link>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <Field label={t('t10misc.auth.newPasswordLabel')}>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              placeholder={t('t10misc.auth.passwordPlaceholder')}
              className={inputClass}
            />
          </Field>
          <p className="text-[11px] text-ink-2 -mt-2">
            {t('t10misc.auth.passwordHint')}
          </p>

          {state?.error && (
            <div
              role="alert"
              className="flex items-start gap-2 bg-danger-bg border border-rose-200 text-danger text-xs font-medium rounded-xl px-3 py-2.5"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <button type="submit" disabled={isPending} className={`${primaryBtnClass} w-full`}>
            <KeyRound size={16} />
            {isPending ? t('t10misc.auth.resetting') : t('t10misc.auth.resetButton')}
          </button>
        </form>
      )}
    </div>
  );
}
