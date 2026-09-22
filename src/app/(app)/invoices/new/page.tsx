import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui';
import { getTaxConfig } from '@/lib/tax';
import InvoiceForm from './InvoiceForm';

export default async function NewInvoicePage() {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  const businessId = session.user.businessId;

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="New invoice"
        subtitle={`Tax is computed on the server — what you see is what gets billed. Default: ${taxConfig.label}.`}
      />
      <InvoiceForm customers={customers} taxConfig={taxConfig} />
    </div>
  );
}
