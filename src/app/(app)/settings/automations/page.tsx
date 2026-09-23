import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageHeader, Card } from '@/components/ui';
import { getAutomationState } from '@/app/actions/automations';
import AutomationsClient from '@/components/AutomationsClient';

export const metadata = { title: 'Automations | EveryJob' };

/**
 * Safe automation controls: the owner can toggle each workflow rule and
 * tune its config, run the engine manually, and audit recent runs.
 * Actions are limited to in-app notifications and drafts by design.
 */
export default async function AutomationsPage() {
  await requireAuth();
  const locale = await getLocale();
  const state = await getAutomationState();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, 'track8.automationsTitle')}
        subtitle={t(locale, 'track8.automationsSubtitle')}
      />
      <Card className="p-5 md:p-6">
        <p className="text-xs text-zinc-500 leading-relaxed">{t(locale, 'track8.safetyNote')}</p>
      </Card>
      <AutomationsClient locale={locale} initial={state} />
    </div>
  );
}
