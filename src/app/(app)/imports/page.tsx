import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageHeader } from '@/components/ui';
import ImportsClient from '@/components/ImportsClient';
import { getGoogleStatus } from '@/app/actions/google-reviews';
import type { CsvType } from '@/lib/csv';

export const metadata = { title: 'Import | EveryJob' };

const VALID_TYPES: CsvType[] = ['customers', 'services', 'jobs'];

export default async function ImportsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await requireAuth();
  const locale = await getLocale();
  const googleStatus = await getGoogleStatus();

  // ?type=customers preselects the import type (linked from the Customers page).
  const { type } = await searchParams;
  const initialType: CsvType = VALID_TYPES.includes(type as CsvType)
    ? (type as CsvType)
    : 'customers';

  return (
    <div className="space-y-6">
      <PageHeader title={t(locale, 'imports.title')} subtitle={t(locale, 'imports.subtitle')} />
      <ImportsClient locale={locale} googleStatus={googleStatus} initialType={initialType} />
    </div>
  );
}
