import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { Card } from '@/components/kit';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { ArrowLeft } from '@/components/icons';
import EquipmentForm from '@/components/EquipmentForm';
import { PageTitle } from '../../_components/PageTitle';

export const dynamic = 'force-dynamic';

export default async function NewEquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const T = (k: string) => t(locale, `equipment.${k}`);

  const { customerId } = await searchParams;

  const customers = await prisma.customer.findMany({
    where: { businessId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 500,
  });

  return (
    <div className="space-y-5 max-w-2xl">
      <Link
        href="/equipment"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink min-h-[44px]"
      >
        <ArrowLeft size={16} /> {T('back')}
      </Link>
      <PageTitle title={T('add')} />
      <Card>
        <EquipmentForm
          customers={customers}
          preselectedCustomerId={customerId ?? null}
          locale={locale}
          mode="create"
        />
      </Card>
    </div>
  );
}
