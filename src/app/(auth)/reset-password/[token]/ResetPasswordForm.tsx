"use client";

import React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { resetPassword } from '@/app/actions/password-reset';
import { useT } from '@/components/LanguageToggle';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';

export default function ResetPasswordForm({ token }: { token: string }) {
  const { t } = useT();
  const [state, formAction, isPending] = useActionState(resetPassword, {});

  return (
    <div className="bg-white rounded-3xl border border-zinc-200/70 shadow-xl shadow-zinc-200/50 p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
        {t('t10misc.auth.resetTitle')}
      </h1>
      <p className="text-sm text-zinc-500 mt-1 mb-6">{t('t10misc.auth.resetSubtitle')}</p>

      {state?.ok ? (
        <div className="space-y-4">
          <div
            role="status"
            className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl px-3 py-3"
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
          <p className="text-[11px] text-zinc-500 -mt-2">
            {t('t10misc.auth.passwordHint')}
          </p>

          {state?.error && (
            <div
              role="alert"
              className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5"
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
