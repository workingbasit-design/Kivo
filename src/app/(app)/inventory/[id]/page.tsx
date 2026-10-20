import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { ArrowLeft } from '@/components/icons';
import PartForm from '@/components/PartForm';
import DeletePartButton from '@/components/DeletePartButton';
import { centsToDollars } from '@/lib/money';
import { Card } from '@/components/kit';
import { PageTitle } from '../../_components/PageTitle';

export const dynamic = 'force-dynamic';

export default async function PartDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const T = (k: string) => t(locale, `inventory.${k}`);
  const { id } = await params;

  const part = await prisma.part.findFirst({
    where: { id, businessId },
  });
  if (!part) notFound();

  return (
    <div className="space-y-5 max-w-2xl">
      <Link
        href="/inventory"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink min-h-[44px]"
      >
        <ArrowLeft size={16} /> {T('back')}
      </Link>
      <PageTitle title={part.name} summary={part.sku ? `SKU: ${part.sku}` : undefined} />
      <div className="flex flex-wrap gap-2">
        <DeletePartButton id={part.id} locale={locale} />
      </div>
      <Card>
        <PartForm
          locale={locale}
          mode="edit"
          existing={{
            id: part.id,
            name: part.name,
            sku: part.sku,
            quantity: part.quantity,
            reorderPoint: part.reorderPoint,
            unitCost: part.unitCostCents == null ? null : centsToDollars(part.unitCostCents),
            unit: part.unit,
            notes: part.notes,
          }}
        />
      </Card>
    </div>
  );
}
