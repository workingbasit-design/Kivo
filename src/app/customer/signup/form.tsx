"use client";

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { ArrowRight, AlertCircle, Eye, EyeOff } from '@/components/icons';
import { customerSignup } from '@/app/actions/customer-auth';
import { t, type Locale } from '@/lib/i18n';
import { Button, Input } from '@/components/kit';
import { HONEYPOT_FIELD, FORM_STARTED_FIELD } from '@/lib/bot-check';

/**
 * Customer signup — mockup split card (2026-11-16), same shell as the
 * login. The brand appears exactly once, in CustomerAuthShell above this
 * form. Signup behaviour is unchanged: the same customerSignup server
 * action, honeypot + fill-time bot check, same error surface.
 */
export default function CustomerSignupForm({ locale }: { locale: Locale }) {
  const [state, formAction, isPending] = useActionState(customerSignup, { error: '' });
  const [showPassword, setShowPassword] = useState(false);
  const tr = (path: string) => t(locale, path as never);
  // B11.1: honeypot + fill-time timestamp for the server-side bot check.
  const [formStartedAt] = useState(() => String(Date.now()));

  return (
    <div className="ej-anim-fade-up grid w-full max-w-5xl overflow-hidden rounded-[24px] border border-line bg-surface shadow-kit-pop md:grid-cols-2">
      {/* Welcome panel */}
      <div className="ej-auth-panel flex min-h-[280px] flex-col justify-center p-8 sm:p-10">
        <p className="ej-eyebrow ej-eyebrow-light">{tr('customer.auth.welcomePanelEyebrow')}</p>
        <h2 className="mt-4 text-[40px] font-light leading-[1.05] tracking-tight text-hero-ink">
          {tr('customer.auth.welcomePanelTitle1')}
          <br />
          {tr('customer.auth.welcomePanelTitle2')}
          <br />
          <span className="font-medium text-lime">{tr('customer.auth.welcomePanelTitle3')}</span>
        </h2>
        <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-hero-ink-2">
          {tr('customer.auth.welcomePanelHint')}
        </p>
      </div>

      {/* Signup panel */}
      <div className="p-6 sm:p-10">
        <p className="ej-eyebrow">{tr('customer.auth.accountEyebrow')}</p>
        <h1 className="mt-2 text-[32px] font-medium leading-tight tracking-tight text-ink">
          {tr('customer.auth.signupTitle')}
        </h1>
        <p className="mb-6 mt-1 text-sm text-ink-2">{tr('customer.auth.signupHint')}</p>

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
          <Input
            label={tr('customer.auth.fullName')}
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Jane Doe"
          />

          <Input
            label={tr('customer.auth.email')}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={tr('customer.auth.phoneOptional')}
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="(416) 555-0100"
            />
            <Input
              label={tr('customer.auth.cityOptional')}
              name="city"
              type="text"
              autoComplete="address-level2"
              placeholder="Toronto"
            />
          </div>

          <label className="field" htmlFor="password-field">
            <span>{tr('customer.auth.password')}</span>
            <div className="relative">
              <input
                id="password-field"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                className="input !pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? tr('customer.auth.hidePassword') : tr('customer.auth.showPassword')}
                aria-pressed={showPassword}
                className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-ink-2 transition-colors hover:text-ink"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </label>

          {state?.error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-line bg-danger-bg px-3 py-2.5 text-xs font-medium text-danger"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {state.error}
            </div>
          )}

          <Button type="submit" disabled={isPending} block>
            {isPending ? tr('customer.auth.creatingAccount') : tr('customer.auth.createAccount')}
            {!isPending && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-2">
          {tr('customer.auth.haveAccount')}{' '}
          <Link href="/customer/login" className="font-semibold text-ink underline underline-offset-2">
            {tr('customer.auth.logIn')}
          </Link>
        </p>

        <p className="mt-6 text-center text-xs text-ink-2">
          {tr('customer.auth.areYouPro')}{' '}
          <Link href="/register" className="font-semibold text-ink underline underline-offset-2">
            {tr('customer.auth.joinAsBusiness')}
          </Link>
        </p>
      </div>
    </div>
  );
}
