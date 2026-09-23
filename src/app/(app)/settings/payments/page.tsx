import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageHeader } from '@/components/ui';
import PaymentsSettingsClient from '@/components/PaymentsSettingsClient';
import { getStripeDashboard } from '@/app/actions/stripe';

export const metadata = { title: 'Online payments | EveryJob' };

export default async function PaymentsSettingsPage() {
  await requireAuth();
  const locale = await getLocale();
  const dashboard = await getStripeDashboard();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, 'payments.title')}
        subtitle={t(locale, 'payments.subtitle')}
      />
      <PaymentsSettingsClient initial={dashboard} locale={locale} />
    </div>
  );
}
