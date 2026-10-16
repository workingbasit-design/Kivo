import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getLocale } from '@/lib/i18n/server';
import AccountingExportClient from '@/components/AccountingExportClient';

export default async function ExportsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const locale = await getLocale();
  
  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      <h1 className="text-xl font-bold text-ink mb-2">
        {locale === 'fr' ? 'Export comptable' : 'Accounting export'}
      </h1>
      <p className="text-sm text-graphite mb-6">
        {locale === 'fr' 
          ? 'Exportez vos données pour QuickBooks, Xero ou Wave.'
          : 'Export your data for QuickBooks, Xero, or Wave.'}
      </p>
      <AccountingExportClient locale={locale} />
    </div>
  );
}
