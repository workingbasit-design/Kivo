import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card } from '@/components/ui';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { ArrowLeft, Pencil } from 'lucide-react';
import EquipmentDetailClient from '@/components/EquipmentDetailClient';

export const dynamic = 'force-dynamic';

export default async function EquipmentDetailPage({
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
    include: { customer: { select: { id: true, name: true } } },
  });
  if (!eq) notFound();

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <Link
          href="/equipment"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 min-h-[44px]"
        >
          <ArrowLeft size={16} /> {T('back')}
        </Link>
        <Link
          href={`/equipment/${eq.id}/edit`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 min-h-[44px]"
        >
          <Pencil size={14} /> {T('edit')}
        </Link>
      </div>
      <PageHeader title={eq.name} subtitle={eq.customer.name} />
      <EquipmentDetailClient
        equipment={{
          id: eq.id,
          name: eq.name,
          brand: eq.brand,
          model: eq.model,
          serial: eq.serial,
          installDate: eq.installDate?.toISOString().slice(0, 10) ?? null,
          notes: eq.notes,
          customerId: eq.customer.id,
          customerName: eq.customer.name,
        }}
        locale={locale}
      />
    </div>
  );
}
