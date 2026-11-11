import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { canSeePrices } from '@/lib/roles';
import { prisma } from '@/lib/prisma';

import { getTaxConfig } from '@/lib/tax';
import { resolveTaxProvince } from '@/lib/property-tax';
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
  const { businessId, role } = await requireAuth();

  // SEE_PRICES gate: creating an invoice means working with prices and
  // totals (including a job's price via ?jobId=). Viewers without the
  // capability (technicians) are bounced to their dashboard first.
  if (!canSeePrices(role)) {
    redirect('/dashboard');
  }

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
      select: { regionCode: true, taxRegion: true, gstHstRegistered: true },
    }),
  ]);

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
    /** Slice 2: the job's service property, when linked — drives the tax default. */
    property: { id: string; label: string; province: string | null } | null;
  } | null = null;
  /** The job's customer province — tax fallback when the job has no property. */
  let jobCustomerProvince: string | null = null;
  if (jobId) {
    const job = await prisma.job.findFirst({
      where: { id: jobId, businessId },
      select: {
        id: true,
        title: true,
        customerId: true,
        priceCents: true,
        property: { select: { id: true, label: true, province: true } },
        customer: { select: { province: true } },
      },
    });
    if (job) {
      jobContext = {
        jobId: job.id,
        jobTitle: job.title,
        customerId: job.customerId,
        price: centsToDollars(job.priceCents),
        property: job.property,
      };
      jobCustomerProvince = job.customer?.province ?? null;
    }
  }

  // Slice 2: the tax default follows the job's service property province
  // when arriving from a job, falling back to the customer's province
  // (2026-11-06 deep test), then the business region. The form's
  // TaxSelect stays freely overridable — this is only the default.
  const taxConfig = getTaxConfig(
    business?.regionCode,
    resolveTaxProvince({
      propertyProvince: jobContext?.property?.province,
      customerProvince: jobCustomerProvince,
      businessTaxRegion: business?.taxRegion,
    })
  );

  return (
    <div className="space-y-6">
      <PageTitle title={t(locale, 'billing.newInvoice')} />
      <InvoiceForm
        customers={customers}
        taxConfig={taxConfig}
        locale={locale}
        jobContext={jobContext}
        gstHstRegistered={business?.gstHstRegistered ?? false}
      />
    </div>
  );
}
