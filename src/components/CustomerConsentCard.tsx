'use client';

import { useActionState, useEffect, useRef } from 'react';
import { BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Badge, Card, checkboxClass, primaryBtnClass } from '@/components/ui';
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
    <Card className="p-6 md:p-8 border-l-4 border-l-lime">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
          <BellRing size={14} className="text-zinc-400" />
          {t(locale, 'messaging.consentTitle')}
        </h2>
        <Badge tone={consent ? 'lime' : 'neutral'}>
          {consent
            ? t(locale, 'messaging.consentOptIn')
            : t(locale, 'messaging.consentOptOut')}
        </Badge>
      </div>
      <p className="text-xs text-zinc-500 mb-4">{t(locale, 'messaging.consentDesc')}</p>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="customerId" value={customerId} />
        <label
          htmlFor="message-consent"
          className="flex items-center gap-3 cursor-pointer rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3 min-h-[56px]"
        >
          <input
            id="message-consent"
            type="checkbox"
            name="consent"
            defaultChecked={consent}
            className={checkboxClass}
          />
          <span className="text-sm font-semibold text-zinc-800">
            {t(locale, 'messaging.consentOptIn')}
          </span>
        </label>
        <label className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
          <span>{t(locale, 'messaging.preferredLocale')}</span>
          <select
            name="preferredLocale"
            defaultValue={preferredLocale ?? ''}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 min-h-[44px] text-xs"
          >
            <option value="">{t(locale, 'messaging.localeAuto')}</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </label>
        {consentAt && (
          <p className="text-[11px] text-zinc-400">
            {new Date(consentAt).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA')}
          </p>
        )}
        {state?.error && <p className="text-xs font-semibold text-rose-600">{state.error}</p>}
        <button type="submit" disabled={isPending} className={primaryBtnClass}>
          {isPending ? '…' : t(locale, 'messaging.saveSettings')}
        </button>
      </form>
    </Card>
  );
}
