import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

import BatchInvoicingClient from '@/components/BatchInvoicingClient';
import { previewBatchInvoices } from '@/app/actions/batch-invoicing';
import { PageTitle } from '../../_components/PageTitle';

export const metadata = { title: 'Batch invoicing | EveryJob' };

export default async function BatchInvoicesPage() {
  await requireAuth();
  const locale = await getLocale();
  const preview = await previewBatchInvoices();

  return (
    <div className="ej-invoices space-y-6">
      <p className="ej-invoices-eyebrow">{t(locale, 'billing.listEyebrow')}</p>
      <PageTitle
        title={t(locale, 'billing.batchTitle')}
        summary={t(locale, 'billing.batchSubtitle')}
      />
      <BatchInvoicingClient
        locale={locale}
        initialRows={preview.rows ?? []}
        loadError={preview.error ?? null}
      />
    </div>
  );
}
