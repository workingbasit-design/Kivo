"use client";

import React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { LogIn, AlertCircle } from '@/components/icons';
import { login } from '@/app/actions/auth';
import { verifyTotpLogin } from '@/app/actions/totp';
import { useT } from '@/components/LanguageToggle';
import { Button, Card, Input } from '@/components/kit';
import GoogleAuthSection from '@/components/GoogleAuthSection';

export default function LoginPage() {
  const { t } = useT();
  const [state, formAction, isPending] = useActionState(login, {});
  // B7.4: second-factor step. Bound to the login result so the challenge
  // issued by the password step is submitted with the code.
  const verifyAction = async (_prev: unknown, formData: FormData) =>
    verifyTotpLogin(String(formData.get('challenge') ?? ''), String(formData.get('code') ?? ''));
  const [totpState, totpFormAction, totpPending] = useActionState(verifyAction, null as unknown as { error?: string } | null);

  if (state?.totpRequired && state.challenge) {
    return (
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {t('t10misc.auth.totpTitle') ?? 'Check your authenticator app'}
        </h1>
        <p className="text-sm text-ink-2 mt-1 mb-6">
          {t('t10misc.auth.totpSubtitle') ?? 'Enter the 6-digit code from your authenticator app.'}
        </p>
        <form action={totpFormAction} className="space-y-4">
          <input type="hidden" name="challenge" value={state.challenge} />
          <Input
            label={t('t10misc.auth.totpLabel') ?? 'Verification code'}
            name="code"
            type="text"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={9}
          />
          {(totpState as { error?: string } | null)?.error && (
            <div
              role="alert"
              className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{(totpState as { error?: string }).error}</span>
            </div>
          )}
          <Button type="submit" disabled={totpPending} block>
            <LogIn size={16} />
            {totpPending
              ? (t('t10misc.auth.verifying') ?? 'Verifying…')
              : (t('t10misc.auth.verifyButton') ?? 'Verify')}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">{t('t10misc.auth.loginTitle')}</h1>
      <p className="text-sm text-ink-2 mt-1 mb-6">{t('t10misc.auth.loginSubtitle')}</p>

      <GoogleAuthSection />

      <form action={formAction} className="space-y-4">
        <Input
          label={t('t10misc.auth.emailLabel')}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t('t10misc.auth.emailPlaceholder')}
        />

        <Input
          label={t('t10misc.auth.passwordLabel')}
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder={t('t10misc.auth.passwordPlaceholder')}
        />

        <div className="flex justify-end -mt-2">
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-ink-2 hover:text-ink hover:underline"
          >
            {t('t10misc.auth.forgotLink')}
          </Link>
        </div>

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
          <LogIn size={16} />
          {isPending ? t('t10misc.auth.loggingIn') : t('t10misc.auth.loginButton')}
        </Button>
      </form>

      <p className="text-center text-xs text-ink-2 mt-6">
        {t('t10misc.auth.newTo')}{' '}
        <Link href="/register" className="font-semibold text-ink hover:underline">
          {t('t10misc.auth.createWorkspace')}
        </Link>
      </p>

      <div className="mt-4 pt-4 border-t border-line text-center">
        <p className="text-xs text-ink-2">
          {t('start.customerTitle') ?? 'Find a pro'}{' '}
          <Link href="/customer/login" className="font-semibold text-ink hover:underline">
            {t('start.customerCta') ?? 'Continue as customer'}
          </Link>
        </p>
      </div>
    </Card>
  );
}
