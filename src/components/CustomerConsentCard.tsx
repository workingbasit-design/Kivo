'use client';

import { useActionState } from 'react';
import { BellRing } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { Card, primaryBtnClass } from '@/components/ui';
import { setCustomerConsentAction } from '@/app/actions/messaging';

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
  const [state, formAction] = useActionState(setCustomerConsentAction, {});

  return (
    <Card className="p-6 md:p-8">
      <h2 className="text-sm font-bold text-zinc-900 mb-1 flex items-center gap-2">
        <BellRing size={14} className="text-zinc-400" />
        {t(locale, 'messaging.consentTitle')}
      </h2>
      <p className="text-xs text-zinc-500 mb-4">{t(locale, 'messaging.consentDesc')}</p>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="customerId" value={customerId} />
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="consent"
            defaultChecked={consent}
            className="mt-0.5 h-4 w-4 accent-emerald-600"
          />
          <span className="text-xs font-semibold text-zinc-800">
            {consent
              ? t(locale, 'messaging.consentOptIn')
              : t(locale, 'messaging.consentOptOut')}
          </span>
        </label>
        <label className="block text-xs text-zinc-600">
          {t(locale, 'messaging.preferredLocale')}{' '}
          <select
            name="preferredLocale"
            defaultValue={preferredLocale ?? ''}
            className="ml-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs"
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
        {state.error && <p className="text-xs font-semibold text-rose-600">{state.error}</p>}
        {state.ok && <p className="text-xs font-semibold text-emerald-600">{t(locale, 'messaging.consentSaved')}</p>}
        <button type="submit" className={primaryBtnClass}>
          {t(locale, 'messaging.saveSettings')}
        </button>
      </form>
    </Card>
  );
}
