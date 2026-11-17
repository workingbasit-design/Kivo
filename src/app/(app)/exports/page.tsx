import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import AccountingExportClient from '@/components/AccountingExportClient';

export default async function ExportsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const locale = await getLocale();
  
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-ink mb-2">
        {t(locale, 'exports.title')}
      </h1>
      <p className="text-sm text-graphite mb-6">
        {t(locale, 'exports.subtitle')}
      </p>
      <AccountingExportClient locale={locale} />
    </div>
  );
}
