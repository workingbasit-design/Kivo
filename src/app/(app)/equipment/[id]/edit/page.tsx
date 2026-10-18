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
import { PageTitle } from '../../../_components/PageTitle';

export const dynamic = 'force-dynamic';

export default async function EditEquipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const T = (k: string) => t(locale, `equipment.${k}`);

  const { id } = await params;
  const eq = await prisma.equipment.findFirst({
    where: { id, businessId },
  });
  if (!eq) notFound();

  return (
    <div className="space-y-5 max-w-2xl">
      <Link
        href={`/equipment/${eq.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink min-h-[44px]"
      >
        <ArrowLeft size={16} /> {T('back')}
      </Link>
      <PageTitle title={T('edit')} summary={eq.name} />
      <Card>
        <EquipmentForm
          customers={[]}
          existing={{
            id: eq.id,
            name: eq.name,
            brand: eq.brand,
            model: eq.model,
            serial: eq.serial,
            installDate: eq.installDate?.toISOString().slice(0, 10) ?? null,
            notes: eq.notes,
          }}
          locale={locale}
          mode="edit"
        />
      </Card>
    </div>
  );
}
