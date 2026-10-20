import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from '@/components/icons';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { Card } from '@/components/kit';
import RecurringForm from '@/components/RecurringForm';
import { createRecurring } from '@/app/actions/recurring';
import { centsToDollars } from '@/lib/money';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageTitle } from '../../_components/PageTitle';

export default async function NewRecurringPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const __biz = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = __biz?.currency;

  const [customers, services] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.service.findMany({
      where: { businessId },
      select: { id: true, name: true, priceCents: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/recurring"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft size={14} /> {t(locale, 'recurringPage.backLink')}
      </Link>

      <PageTitle
        title={t(locale, 'recurringPage.newTitle')}
        summary={t(locale, 'recurringPage.newSubtitle')}
      />

      <Card className="p-6">
        {customers.length === 0 ? (
          <div className="space-y-5">
            <div className="bg-warn-bg border border-warn-line text-warn-text text-xs font-medium rounded-xl px-4 py-3">
              You need a customer first.{' '}
              <Link href="/customers" className="font-bold underline">
                Add one
              </Link>{' '}
              - it takes a few seconds.
            </div>
          </div>
        ) : (
          <RecurringForm
            customers={customers}
            services={services.map((s) => ({
              id: s.id,
              name: s.name,
              price: centsToDollars(s.priceCents),
            }))}
            action={createRecurring}
            submitLabel="Create plan"
            currency={currency}
          />
        )}
      </Card>
    </div>
  );
}
