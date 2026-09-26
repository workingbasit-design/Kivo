"use client";

import React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { MailQuestion, AlertCircle, CheckCircle2 } from 'lucide-react';
import { requestPasswordReset } from '@/app/actions/password-reset';
import { useT } from '@/components/LanguageToggle';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';

export default function ForgotPasswordPage() {
  const { t } = useT();
  const [state, formAction, isPending] = useActionState(requestPasswordReset, {});

  return (
    <div className="bg-white rounded-3xl border border-zinc-200/70 shadow-xl shadow-zinc-200/50 p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
        {t('t10misc.auth.forgotTitle')}
      </h1>
      <p className="text-sm text-zinc-500 mt-1 mb-6">{t('t10misc.auth.forgotSubtitle')}</p>

      {state?.ok ? (
        <div
          role="status"
          className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl px-3 py-3"
        >
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{t('t10misc.auth.forgotSent')}</span>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <Field label={t('t10misc.auth.emailLabel')}>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder={t('t10misc.auth.emailPlaceholder')}
              className={inputClass}
            />
          </Field>

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
            <MailQuestion size={16} />
            {isPending ? t('t10misc.auth.sending') : t('t10misc.auth.forgotButton')}
          </button>
        </form>
      )}

      <p className="text-center text-xs text-zinc-500 mt-6">
        <Link href="/login" className="font-semibold text-ink hover:underline">
          {t('t10misc.auth.backToLogin')}
        </Link>
      </p>
    </div>
  );
}
