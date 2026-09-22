import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui';
import { getTaxConfig } from '@/lib/tax';
import QuoteForm from './QuoteForm';

export default async function NewQuotePage() {
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
        title="New quote"
        subtitle={`Line items in, total out — ${taxConfig.label} is added automatically from your region settings.`}
      />
      <QuoteForm customers={customers} taxConfig={taxConfig} />
    </div>
  );
}
