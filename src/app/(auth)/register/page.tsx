"use client";

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { BadgeCheck, AlertCircle, CheckCircle2 } from '@/components/icons';
import { register } from '@/app/actions/auth';
import { useT } from '@/components/LanguageToggle';
import { Button, Card, Chip, Input } from '@/components/kit';
import GoogleAuthSection from '@/components/GoogleAuthSection';
import { HONEYPOT_FIELD, FORM_STARTED_FIELD } from '@/lib/bot-check';

export default function RegisterPage() {
  const { t } = useT();
  const [state, formAction, isPending] = useActionState(register, {});
  // B11.1: honeypot + fill-time timestamp for the server-side bot check.
  const [formStartedAt] = useState(() => String(Date.now()));

  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-4">
        <Chip tone="ok" icon={<BadgeCheck />}>
          {t('t10misc.auth.freePlanBadge')}
        </Chip>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-ink">{t('t10misc.auth.registerTitle')}</h1>
      <p className="text-sm text-ink-2 mt-1 mb-6">{t('t10misc.auth.registerSubtitle')}</p>

      <GoogleAuthSection />

      <form action={formAction} className="space-y-4">
        {/* Honeypot: invisible to humans (off-screen + aria-hidden); bots that
            fill it are rejected server-side. */}
        <div
          aria-hidden="true"
          className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden"
        >
          <label htmlFor="reg-website">Website</label>
          <input
            id="reg-website"
            name={HONEYPOT_FIELD}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </div>
        <input type="hidden" name={FORM_STARTED_FIELD} value={formStartedAt} />
        <Input
          label={t('t10misc.auth.yourName')}
          name="name"
          type="text"
          required
          autoComplete="name"
          placeholder={t('t10misc.auth.yourNamePlaceholder')}
        />

        <Input
          label={t('t10misc.auth.businessName')}
          name="businessName"
          type="text"
          required
          autoComplete="organization"
          placeholder={t('t10misc.auth.businessNamePlaceholder')}
        />

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
          hint={t('t10misc.auth.passwordHint')}
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder={t('t10misc.auth.passwordPlaceholder')}
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
          <CheckCircle2 size={16} />
          {isPending ? t('t10misc.auth.creating') : t('t10misc.auth.registerButton')}
        </Button>
      </form>

      <p className="text-center text-xs text-ink-2 mt-5">
        {t('t10misc.auth.termsPrefix')}{' '}
        <Link href="/terms" className="underline hover:text-ink">
          {t('t10misc.auth.termsLink')}
        </Link>{' '}
        {t('t10misc.auth.termsAnd')}{' '}
        <Link href="/privacy" className="underline hover:text-ink">
          {t('t10misc.auth.privacyLink')}
        </Link>
        .
      </p>

      <p className="text-center text-xs text-ink-2 mt-4">
        {t('t10misc.auth.haveAccount')}{' '}
        <Link href="/login" className="font-semibold text-ink hover:underline">
          {t('t10misc.auth.loginLink')}
        </Link>
      </p>
    </Card>
  );
}
