import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { getTaxConfig } from '@/lib/tax';
import QuoteForm from './QuoteForm';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageTitle } from '../../_components/PageTitle';

export default async function NewQuotePage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();

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
      <PageTitle
        title={t(locale, 'quotes.new.title')}
        summary={t(locale, 'quotes.new.subtitle').replace('{taxLabel}', taxConfig.label)}
      />
      <QuoteForm customers={customers} taxConfig={taxConfig} locale={locale} />
    </div>
  );
}
