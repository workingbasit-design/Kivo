'use client';

import { useActionState, useEffect, useRef } from 'react';
import { BellRing } from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Button, Card, Select, StatusBadge } from '@/components/kit';
import { setCustomerConsentAction } from '@/app/actions/messaging';

/**
 * Fires a toast exactly once per server-action result. Minimal inline
 * replacement for the removed useActionToast helper.
 */
function useResultToast<T extends { ok?: boolean; error?: string }>(
  state: T | undefined,
  messages: { success?: string; error?: string }
) {
  const seen = useRef<T | undefined>(undefined);
  useEffect(() => {
    if (!state || seen.current === state) return;
    seen.current = state;
    if (state.ok && messages.success) {
      toast.success(messages.success);
    } else if (state.error) {
      toast.error(messages.error ?? state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

/**
 * CASL opt-in card on the customer detail page. Automated WhatsApp/email
 * only ever goes to customers whose owner has explicitly opted them in here
 * (or who texted STOP/HELP, handled by the webhook).
 */
export default function CustomerConsentCard({
  customerId,
  consent,
  consentAt,
  preferredLocale,
  locale,
}: {
  customerId: string;
  consent: boolean;
  consentAt: string | null;
  preferredLocale: string | null;
  locale: Locale;
}) {
  const [state, formAction, isPending] = useActionState(setCustomerConsentAction, {});

  useResultToast(state, {
    success: t(locale, 'messaging.consentSaved'),
  });

  return (
    <Card className="p-6 md:p-8 border-l-4 border-l-hivis">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-sm font-bold text-ink flex items-center gap-2">
          <BellRing size={14} className="text-ink-2" />
          {t(locale, 'messaging.consentTitle')}
        </h2>
        <StatusBadge tone={consent ? 'done' : 'neutral'}>
          {consent
            ? t(locale, 'messaging.consentOptIn')
            : t(locale, 'messaging.consentOptOut')}
        </StatusBadge>
      </div>
      <p className="text-xs text-ink-2 mb-4">{t(locale, 'messaging.consentDesc')}</p>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="customerId" value={customerId} />
        <label
          htmlFor="message-consent"
          className="flex items-center gap-3 cursor-pointer rounded-xl border border-line bg-surface-2/60 px-4 py-3 min-h-[56px]"
        >
          <input
            id="message-consent"
            type="checkbox"
            name="consent"
            defaultChecked={consent}
            className="w-5 h-5 rounded-md border-line-strong accent-ink focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2"
          />
          <span className="text-sm font-semibold text-ink">
            {t(locale, 'messaging.consentOptIn')}
          </span>
        </label>
        <Select
          label={t(locale, 'messaging.preferredLocale')}
          name="preferredLocale"
          defaultValue={preferredLocale ?? ''}
          options={[
            { value: '', label: t(locale, 'messaging.localeAuto') },
            { value: 'en', label: 'English' },
            { value: 'fr', label: 'Français' },
          ]}
        />
        {consentAt && (
          <p className="text-[11px] text-ink-2">
            {new Date(consentAt).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA')}
          </p>
        )}
        {state?.error && <p className="text-xs font-semibold text-danger">{state.error}</p>}
        <Button
          variant="primary"
          type="submit"
          disabled={isPending}
          className="disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? '…' : t(locale, 'messaging.saveSettings')}
        </Button>
      </form>
    </Card>
  );
}
