import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageHeader } from '@/components/ui';
import MessagingSettingsClient from '@/components/MessagingSettingsClient';
import { getMessagingDashboard } from '@/app/actions/messaging';

export const metadata = { title: 'Automated messaging | EveryJob' };

export default async function MessagingSettingsPage() {
  await requireAuth();
  const locale = await getLocale();
  const dashboard = await getMessagingDashboard();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, 'messaging.title')}
        subtitle={t(locale, 'messaging.subtitle')}
      />
      <MessagingSettingsClient initial={dashboard} locale={locale} />
    </div>
  );
}
