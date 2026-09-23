import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageHeader } from '@/components/ui';
import BatchInvoicingClient from '@/components/BatchInvoicingClient';
import { previewBatchInvoices } from '@/app/actions/batch-invoicing';

export const metadata = { title: 'Batch invoicing | EveryJob' };

export default async function BatchInvoicesPage() {
  await requireAuth();
  const locale = await getLocale();
  const preview = await previewBatchInvoices();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, 'billing.batchTitle')}
        subtitle={t(locale, 'billing.batchSubtitle')}
      />
      <BatchInvoicingClient
        locale={locale}
        initialRows={preview.rows ?? []}
        loadError={preview.error ?? null}
      />
    </div>
  );
}
