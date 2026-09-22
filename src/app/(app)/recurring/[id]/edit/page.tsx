import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card } from '@/components/ui';
import RecurringForm from '@/components/RecurringForm';
import { updateRecurring } from '@/app/actions/recurring';
import { toISODateLocal } from '@/lib/utils';

export default async function EditRecurringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { businessId } = await requireAuth();
  const __biz = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = __biz?.currency;
  const { id } = await params;

  const [plan, customers, services] = await Promise.all([
    prisma.recurringJob.findFirst({ where: { id, businessId } }),
    prisma.customer.findMany({
      where: { businessId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.service.findMany({
      where: { businessId },
      select: { id: true, name: true, price: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!plan) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/recurring"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft size={14} /> Back to recurring jobs
      </Link>

      <PageHeader title="Edit recurring plan" subtitle={plan.title} />

      <Card className="p-6">
        <RecurringForm
          customers={customers}
          services={services}
          action={updateRecurring}
          submitLabel="Save changes"
          currency={currency}
          initial={{
            id: plan.id,
            title: plan.title,
            customerId: plan.customerId,
            frequency: plan.frequency,
            startDate: toISODateLocal(plan.nextRun),
            time: plan.time,
            address: plan.address,
            price: plan.price,
            notes: plan.notes,
          }}
        />
      </Card>
    </div>
  );
}
