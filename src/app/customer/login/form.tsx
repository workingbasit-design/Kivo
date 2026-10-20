"use client";

import Link from 'next/link';
import { useActionState } from 'react';
import { LogIn, AlertCircle, Search } from '@/components/icons';
import { customerLogin } from '@/app/actions/customer-auth';
import { t, type Locale } from '@/lib/i18n';
import { Button, Card, Input } from '@/components/kit';
import { LanguageToggle } from '@/components/LanguageToggle';
import Logo from '@/components/Logo';

export default function CustomerLoginForm({ locale, next }: { locale: Locale; next?: string | null }) {
  const [state, formAction, isPending] = useActionState(customerLogin, { error: '' });
  const tr = (path: string) => t(locale, path as never);

  return (
    <div className="min-h-dvh bg-surface-2 flex flex-col -m-4 -mt-4">
      <header className="p-4 flex items-center justify-between">
        <Link href="/directory" className="inline-flex items-center gap-2 group">
          <span className="transition-transform duration-300 group-hover:scale-105 group-active:scale-95 inline-flex">
            <Logo />
          </span>
        </Link>
        <LanguageToggle current={locale} />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        <Card className="ej-anim-fade-up w-full max-w-sm p-6 sm:p-8">
          <div className="flex items-center gap-2 text-ink-2 mb-2">
            <Search className="w-5 h-5" />
            <span className="text-xs font-bold">{tr('customer.auth.forCustomers')}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{tr('customer.auth.loginTitle')}</h1>
          <p className="text-sm text-ink-2 mt-1 mb-6">
            {tr('customer.auth.loginHint')}
          </p>

          <form action={formAction} className="space-y-4">
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <Input
              label={tr('customer.auth.email')}
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />

            <Input
              label={tr('customer.auth.password')}
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />

            {state?.error && (
              <div
                role="alert"
                className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {state.error}
              </div>
            )}

            <Button type="submit" disabled={isPending} block>
              <LogIn className="w-4 h-4" />
              {isPending ? tr('customer.auth.loggingIn') : tr('customer.auth.logIn')}
            </Button>
          </form>

          <p className="text-sm text-ink-2 mt-6 text-center">
            {tr('customer.auth.newHere')}{' '}
            <Link href="/customer/signup" className="font-semibold text-ink underline underline-offset-2">
              {tr('customer.auth.createFreeAccount')}
            </Link>
          </p>

          <p className="text-xs text-ink-2 mt-6 text-center">
            {tr('customer.auth.areYouPro')}{' '}
            <Link href="/login" className="font-semibold text-ink underline underline-offset-2">
              {tr('customer.auth.businessLogin')}
            </Link>
          </p>
        </Card>
      </main>
    </div>
  );
}
