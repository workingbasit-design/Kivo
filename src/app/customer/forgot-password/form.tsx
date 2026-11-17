'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, CheckCircle2 } from '@/components/icons';
import { requestCustomerPasswordReset } from '@/app/actions/customer-password-reset';
import { t, type Locale } from '@/lib/i18n';
import { Button, Card, Input } from '@/components/kit';

/**
 * Customer forgot-password — mirrors the business flow under (auth).
 * Always shows the same "sent" state for a valid email shape, so the page
 * can never be used to enumerate registered emails.
 */
export default function CustomerForgotPasswordForm({ locale }: { locale: Locale }) {
  const [state, formAction, isPending] = useActionState(requestCustomerPasswordReset, {});
  const tr = (path: string) => t(locale, path as never);

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        {tr('customer.auth.forgotTitle')}
      </h1>
      <p className="text-sm text-ink-2 mt-1 mb-6">{tr('customer.auth.forgotSub')}</p>

      {state?.ok ? (
        <div className="space-y-4">
          <div
            role="status"
            className="flex items-start gap-2 bg-ok-bg border border-line text-ok text-sm rounded-xl px-3 py-3"
          >
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>{tr('customer.auth.forgotSent')}</span>
          </div>
          <Button href="/customer/login" block>
            {tr('customer.auth.backToLogin')}
          </Button>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <Input
            label={tr('customer.auth.email')}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
          />

          {state?.error && (
            <div
              role="alert"
              className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <Button type="submit" disabled={isPending} block>
            {isPending ? tr('customer.auth.sendingLink') : tr('customer.auth.forgotButton')}
          </Button>

          <p className="text-center text-sm text-ink-2">
            <Link href="/customer/login" className="font-semibold text-ink underline underline-offset-2">
              {tr('customer.auth.backToLogin')}
            </Link>
          </p>
        </form>
      )}
    </Card>
  );
}
