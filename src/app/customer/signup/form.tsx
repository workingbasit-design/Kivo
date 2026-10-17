"use client";

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { UserPlus, AlertCircle, Search } from '@/components/icons';
import { customerSignup } from '@/app/actions/customer-auth';
import { t, type Locale } from '@/lib/i18n';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import { LanguageToggle } from '@/components/LanguageToggle';
import Logo from '@/components/Logo';
import { HONEYPOT_FIELD, FORM_STARTED_FIELD } from '@/lib/bot-check';

export default function CustomerSignupForm({ locale }: { locale: Locale }) {
  const [state, formAction, isPending] = useActionState(customerSignup, { error: '' });
  const tr = (path: string) => t(locale, path as never);
  // B11.1: honeypot + fill-time timestamp for the server-side bot check.
  const [formStartedAt] = useState(() => String(Date.now()));

  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-50 to-white flex flex-col -m-4 -mt-4">
      <header className="p-4 flex items-center justify-between">
        <Link href="/directory" className="inline-flex items-center gap-2 group">
          <span className="transition-transform duration-300 group-hover:scale-105 group-active:scale-95 inline-flex">
            <Logo />
          </span>
        </Link>
        <LanguageToggle current={locale} />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="ej-anim-fade-up w-full max-w-sm bg-surface rounded-3xl border border-line/70 shadow-xl shadow-zinc-200/50 p-6 sm:p-8">
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <Search className="w-5 h-5" />
            <span className="text-xs font-bold">{tr('customer.auth.forCustomers')}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{tr('customer.auth.signupTitle')}</h1>
          <p className="text-sm text-ink-2 mt-1 mb-6">
            {tr('customer.auth.signupHint')}
          </p>

          <form action={formAction} className="space-y-4">
            {/* Honeypot: invisible to humans (off-screen + aria-hidden); bots that
                fill it are rejected server-side. */}
            <div
              aria-hidden="true"
              className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden"
            >
              <label htmlFor="cs-website">Website</label>
              <input
                id="cs-website"
                name={HONEYPOT_FIELD}
                type="text"
                tabIndex={-1}
                autoComplete="off"
                defaultValue=""
              />
            </div>
            <input type="hidden" name={FORM_STARTED_FIELD} value={formStartedAt} />
            <Field label={tr('customer.auth.fullName')}>
              <input
                id="name"
                name="name"
                type="text"
                required
                autoComplete="name"
                placeholder="Jane Doe"
                className={inputClass}
              />
            </Field>

            <Field label={tr('customer.auth.email')}>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={tr('customer.auth.phoneOptional')}>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="(416) 555-0100"
                  className={inputClass}
                />
              </Field>
              <Field label={tr('customer.auth.cityOptional')}>
                <input
                  id="city"
                  name="city"
                  type="text"
                  autoComplete="address-level2"
                  placeholder="Toronto"
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label={tr('customer.auth.password')}>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                className={inputClass}
              />
            </Field>

            {state?.error && (
              <div
                role="alert"
                className="flex items-start gap-2 bg-danger-bg border border-rose-200 text-danger text-xs font-medium rounded-xl px-3 py-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {state.error}
              </div>
            )}

            <button type="submit" disabled={isPending} className={primaryBtnClass}>
              <UserPlus className="w-4 h-4" />
              {isPending ? tr('customer.auth.creatingAccount') : tr('customer.auth.createAccount')}
            </button>
          </form>

          <p className="text-sm text-ink-2 mt-6 text-center">
            {tr('customer.auth.haveAccount')}{' '}
            <Link href="/customer/login" className="font-semibold text-indigo-600 hover:underline">
              {tr('customer.auth.logIn')}
            </Link>
          </p>

          <p className="text-xs text-ink-2 mt-6 text-center">
            {tr('customer.auth.areYouPro')}{' '}
            <Link href="/register" className="font-semibold text-indigo-600 hover:underline">
              {tr('customer.auth.joinAsBusiness')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
