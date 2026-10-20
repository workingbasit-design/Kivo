"use client";

import React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { MailQuestion, AlertCircle, CheckCircle2 } from '@/components/icons';
import { requestPasswordReset } from '@/app/actions/password-reset';
import { useT } from '@/components/LanguageToggle';
import { Button, Card, Input } from '@/components/kit';

export default function ForgotPasswordPage() {
  const { t } = useT();
  const [state, formAction, isPending] = useActionState(requestPasswordReset, {});

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        {t('t10misc.auth.forgotTitle')}
      </h1>
      <p className="text-sm text-ink-2 mt-1 mb-6">{t('t10misc.auth.forgotSubtitle')}</p>

      {state?.ok ? (
        <div
          role="status"
          className="flex items-start gap-2 bg-ok-bg border border-line text-ok text-sm rounded-xl px-3 py-3"
        >
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{t('t10misc.auth.forgotSent')}</span>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <Input
            label={t('t10misc.auth.emailLabel')}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={t('t10misc.auth.emailPlaceholder')}
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
            <MailQuestion size={16} />
            {isPending ? t('t10misc.auth.sending') : t('t10misc.auth.forgotButton')}
          </Button>
        </form>
      )}

      <p className="text-center text-xs text-ink-2 mt-6">
        <Link href="/login" className="font-semibold text-ink hover:underline">
          {t('t10misc.auth.backToLogin')}
        </Link>
      </p>
    </Card>
  );
}
