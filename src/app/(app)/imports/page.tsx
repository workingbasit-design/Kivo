import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageHeader } from '@/components/ui';
import ImportsClient from '@/components/ImportsClient';
import { getGoogleStatus } from '@/app/actions/google-reviews';

export const metadata = { title: 'Import | EveryJob' };

export default async function ImportsPage() {
  await requireAuth();
  const locale = await getLocale();
  const googleStatus = await getGoogleStatus();

  return (
    <div className="space-y-6">
      <PageHeader title={t(locale, 'imports.title')} subtitle={t(locale, 'imports.subtitle')} />
      <ImportsClient locale={locale} googleStatus={googleStatus} />
    </div>
  );
}
