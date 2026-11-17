'use client';

import { useActionState } from 'react';
import { KeyRound, AlertCircle, CheckCircle2 } from '@/components/icons';
import { resetCustomerPassword } from '@/app/actions/customer-password-reset';
import { t, type Locale } from '@/lib/i18n';
import { Button, Card, Input } from '@/components/kit';

/** Customer reset-password — mirrors the business ResetPasswordForm. */
export default function CustomerResetPasswordForm({
  locale,
  token,
}: {
  locale: Locale;
  token: string;
}) {
  const [state, formAction, isPending] = useActionState(resetCustomerPassword, {});
  const tr = (path: string) => t(locale, path as never);

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        {tr('customer.auth.resetTitle')}
      </h1>
      <p className="text-sm text-ink-2 mt-1 mb-6">{tr('customer.auth.resetSub')}</p>

      {state?.ok ? (
        <div className="space-y-4">
          <div
            role="status"
            className="flex items-start gap-2 bg-ok-bg border border-line text-ok text-sm rounded-xl px-3 py-3"
          >
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>{tr('customer.auth.resetDone')}</span>
          </div>
          <Button href="/customer/login" block>
            {tr('customer.auth.backToLogin')}
          </Button>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <Input
            label={tr('customer.auth.newPassword')}
            hint={tr('customer.auth.resetSub')}
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
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
            <KeyRound size={16} />
            {isPending ? tr('customer.auth.resetting') : tr('customer.auth.resetButton')}
          </Button>
        </form>
      )}
    </Card>
  );
}
