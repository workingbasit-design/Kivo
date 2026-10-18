import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

import PaymentsSettingsClient from '@/components/PaymentsSettingsClient';
import { getStripeDashboard } from '@/app/actions/stripe';
import { PageTitle } from '../../_components/PageTitle';

export const metadata = { title: 'Online payments | EveryJob' };

export default async function PaymentsSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ stripe?: string }>;
}) {
  await requireAuth();
  const locale = await getLocale();
  const dashboard = await getStripeDashboard();
  const params = await searchParams;
  const connectFailed = params?.stripe === 'not-configured';
  return (
    <div className="space-y-6">
      <PageTitle
        title={t(locale, 'payments.title')}
        summary={t(locale, 'payments.subtitle')}
      />
      <PaymentsSettingsClient initial={dashboard} locale={locale} connectFailed={connectFailed} />
    </div>
  );
}
