"use client";

import React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { BadgeCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { register } from '@/app/actions/auth';
import { useT } from '@/components/LanguageToggle';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import GoogleAuthSection from '@/components/GoogleAuthSection';

export default function RegisterPage() {
  const { t } = useT();
  const [state, formAction, isPending] = useActionState(register, {});

  return (
    <div className="bg-white rounded-3xl border border-zinc-200/70 shadow-xl shadow-zinc-200/50 p-6 sm:p-8">
      <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-full mb-4">
        <BadgeCheck size={12} /> {t('t10misc.auth.freePlanBadge')}
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t('t10misc.auth.registerTitle')}</h1>
      <p className="text-sm text-zinc-500 mt-1 mb-6">{t('t10misc.auth.registerSubtitle')}</p>

      <GoogleAuthSection />

      <form action={formAction} className="space-y-4">
        <Field label={t('t10misc.auth.yourName')}>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder={t('t10misc.auth.yourNamePlaceholder')}
            className={inputClass}
          />
        </Field>

        <Field label={t('t10misc.auth.businessName')}>
          <input
            id="businessName"
            name="businessName"
            type="text"
            required
            autoComplete="organization"
            placeholder={t('t10misc.auth.businessNamePlaceholder')}
            className={inputClass}
          />
        </Field>

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

        <Field label={t('t10misc.auth.passwordLabel')} hint={t('t10misc.auth.passwordHint')}>
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
          <CheckCircle2 size={16} />
          {isPending ? t('t10misc.auth.creating') : t('t10misc.auth.registerButton')}
        </button>
      </form>

      <p className="text-center text-xs text-zinc-500 mt-6">
        {t('t10misc.auth.haveAccount')}{' '}
        <Link href="/login" className="font-semibold text-ink hover:underline">
          {t('t10misc.auth.loginLink')}
        </Link>
      </p>
    </div>
  );
}
