import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card } from '@/components/ui';
import RecurringForm from '@/components/RecurringForm';
import { createRecurring } from '@/app/actions/recurring';

export default async function NewRecurringPage() {
  const { businessId } = await requireAuth();
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
      select: { id: true, name: true, price: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/recurring"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft size={14} /> Back to recurring jobs
      </Link>

      <PageHeader
        title="New recurring plan"
        subtitle="Set it once — EveryJob creates a job every week, fortnight, or month."
      />

      <Card className="p-6">
        {customers.length === 0 ? (
          <div className="space-y-5">
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium rounded-xl px-4 py-3">
              You need a customer first.{' '}
              <Link href="/customers" className="font-bold underline">
                Add one
              </Link>{' '}
              — it takes a few seconds.
            </div>
          </div>
        ) : (
          <RecurringForm customers={customers} services={services} action={createRecurring} submitLabel="Create plan" currency={currency} />
        )}
      </Card>
    </div>
  );
}
