"use client";

import React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
import { login } from '@/app/actions/auth';
import { useT } from '@/components/LanguageToggle';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import GoogleAuthSection from '@/components/GoogleAuthSection';

export default function LoginPage() {
  const { t } = useT();
  const [state, formAction, isPending] = useActionState(login, {});

  return (
    <div className="bg-white rounded-3xl border border-zinc-200/70 shadow-xl shadow-zinc-200/50 p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t('t10misc.auth.loginTitle')}</h1>
      <p className="text-sm text-zinc-500 mt-1 mb-6">{t('t10misc.auth.loginSubtitle')}</p>

      <GoogleAuthSection />

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

        <Field label={t('t10misc.auth.passwordLabel')}>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder={t('t10misc.auth.passwordPlaceholder')}
            className={inputClass}
          />
        </Field>

        <div className="flex justify-end -mt-2">
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-zinc-500 hover:text-ink hover:underline"
          >
            {t('t10misc.auth.forgotLink')}
          </Link>
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

        <button type="submit" disabled={isPending} className={`${primaryBtnClass} w-full`}>
          <LogIn size={16} />
          {isPending ? t('t10misc.auth.loggingIn') : t('t10misc.auth.loginButton')}
        </button>
      </form>

      <p className="text-center text-xs text-zinc-500 mt-6">
        {t('t10misc.auth.newTo')}{' '}
        <Link href="/register" className="font-semibold text-ink hover:underline">
          {t('t10misc.auth.createWorkspace')}
        </Link>
      </p>
    </div>
  );
}
