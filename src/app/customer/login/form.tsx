"use client";

import Link from 'next/link';
import { useActionState } from 'react';
import { LogIn, AlertCircle, Search } from 'lucide-react';
import { customerLogin } from '@/app/actions/customer-auth';
import { t, type Locale } from '@/lib/i18n';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import Logo from '@/components/Logo';

export default function CustomerLoginForm({ locale }: { locale: Locale }) {
  const [state, formAction, isPending] = useActionState(customerLogin, { error: '' });
  const tr = (path: string) => t(locale, path as never);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-50 to-white flex flex-col -m-4 -mt-4">
      <header className="p-4">
        <Link href="/directory" className="inline-flex items-center gap-2 group">
          <span className="transition-transform duration-300 group-hover:scale-105 group-active:scale-95 inline-flex">
            <Logo />
          </span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="ej-anim-fade-up w-full max-w-sm bg-white rounded-3xl border border-zinc-200/70 shadow-xl shadow-zinc-200/50 p-6 sm:p-8">
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <Search className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">{tr('customer.auth.forCustomers')}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{tr('customer.auth.loginTitle')}</h1>
          <p className="text-sm text-zinc-500 mt-1 mb-6">
            {tr('customer.auth.loginHint')}
          </p>

          <form action={formAction} className="space-y-4">
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

            <Field label={tr('customer.auth.password')}>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={inputClass}
              />
            </Field>

            {state?.error && (
              <div
                role="alert"
                className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {state.error}
              </div>
            )}

            <button type="submit" disabled={isPending} className={primaryBtnClass}>
              <LogIn className="w-4 h-4" />
              {isPending ? tr('customer.auth.loggingIn') : tr('customer.auth.logIn')}
            </button>
          </form>

          <p className="text-sm text-zinc-500 mt-6 text-center">
            {tr('customer.auth.newHere')}{' '}
            <Link href="/customer/signup" className="font-semibold text-indigo-600 hover:underline">
              {tr('customer.auth.createFreeAccount')}
            </Link>
          </p>

          <p className="text-xs text-zinc-500 mt-6 text-center">
            {tr('customer.auth.areYouPro')}{' '}
            <Link href="/login" className="font-semibold text-indigo-600 hover:underline">
              {tr('customer.auth.businessLogin')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
