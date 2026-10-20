import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

import MessagingSettingsClient from '@/components/MessagingSettingsClient';
import { getMessagingDashboard } from '@/app/actions/messaging';
import { PageTitle } from '../../_components/PageTitle';

export const metadata = { title: 'Automated messaging | EveryJob' };

export default async function MessagingSettingsPage() {
  await requireAuth();
  const locale = await getLocale();
  const dashboard = await getMessagingDashboard();
  return (
    <div className="space-y-6">
      <PageTitle
        title={t(locale, 'messaging.title')}
        summary={t(locale, 'messaging.subtitle')}
      />
      <MessagingSettingsClient initial={dashboard} locale={locale} />
    </div>
  );
}
