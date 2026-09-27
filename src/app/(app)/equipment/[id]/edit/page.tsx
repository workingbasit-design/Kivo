import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card } from '@/components/ui';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { ArrowLeft } from 'lucide-react';
import EquipmentForm from '@/components/EquipmentForm';

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
        className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 min-h-[44px]"
      >
        <ArrowLeft size={16} /> {T('back')}
      </Link>
      <PageHeader title={T('edit')} subtitle={eq.name} />
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
