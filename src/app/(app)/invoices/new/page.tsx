import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { getTaxConfig } from '@/lib/tax';
import { centsToDollars } from '@/lib/money';
import InvoiceForm from './InvoiceForm';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageTitle } from '../../_components/PageTitle';

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const { jobId } = await searchParams;

  const [customers, business] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.business.findUnique({
      where: { id: businessId },
      select: { regionCode: true, taxRegion: true },
    }),
  ]);

  const taxConfig = getTaxConfig(business?.regionCode, business?.taxRegion);

  // D4 (2026-10-21): arriving from a job's "Create invoice" button
  // (?jobId=) prefills the form from that job — customer preselected,
  // first line item from the job — and the created invoice links back
  // to the job. Tenant-scoped: a foreign or stale jobId just yields the
  // plain blank form.
  let jobContext: {
    jobId: string;
    jobTitle: string;
    customerId: string;
    price: number;
  } | null = null;
  if (jobId) {
    const job = await prisma.job.findFirst({
      where: { id: jobId, businessId },
      select: { id: true, title: true, customerId: true, priceCents: true },
    });
    if (job) {
      jobContext = {
        jobId: job.id,
        jobTitle: job.title,
        customerId: job.customerId,
        price: centsToDollars(job.priceCents),
      };
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle title={t(locale, 'billing.newInvoice')} />
      <InvoiceForm
        customers={customers}
        taxConfig={taxConfig}
        locale={locale}
        jobContext={jobContext}
      />
    </div>
  );
}
