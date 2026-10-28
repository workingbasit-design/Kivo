import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { canSeePrices } from '@/lib/roles';
import { prisma } from '@/lib/prisma';

import { getTaxConfig } from '@/lib/tax';
import { centsToDollars } from '@/lib/money';
import QuoteForm from './QuoteForm';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageTitle } from '../../_components/PageTitle';

export default async function NewQuotePage() {
  const { businessId, role } = await requireAuth();

  // Slice 4 consistency fix: quotes/new never had the SEE_PRICES gate
  // that the list, detail, and invoices/new pages all carry. Creating a
  // quote means working with prices — technicians bounce to dashboard.
  if (!canSeePrices(role)) {
    redirect('/dashboard');
  }

  const locale = await getLocale();

  const [customers, business, templates] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.business.findUnique({
      where: { id: businessId },
      select: { regionCode: true, taxRegion: true },
    }),
    // Slice 4: templates for the "start from template" picker.
    prisma.quoteTemplate.findMany({
      where: { businessId },
      include: { items: { orderBy: { position: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const taxConfig = getTaxConfig(business?.regionCode, business?.taxRegion);

  return (
    <div className="space-y-6">
      <PageTitle
        title={t(locale, 'quotes.new.title')}
        summary={t(locale, 'quotes.new.subtitle').replace('{taxLabel}', taxConfig.label)}
      />
      <QuoteForm
        customers={customers}
        taxConfig={taxConfig}
        templates={templates.map((tpl) => ({
          id: tpl.id,
          name: tpl.name,
          items: tpl.items.map((li) => ({
            desc: li.description,
            qty: String(li.qty),
            rate: String(centsToDollars(li.unitPriceCents)),
            cost:
              li.unitCostCents == null
                ? ''
                : String(centsToDollars(li.unitCostCents)),
          })),
        }))}
        locale={locale}
      />
    </div>
  );
}
