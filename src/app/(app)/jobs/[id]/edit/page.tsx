import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card } from '@/components/ui';
import JobForm from '@/components/JobForm';
import { updateJob } from '@/app/actions/jobs';
import { toISODateLocal } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const T = (k: string) => t(locale, `t10work.${k}`);

  const [job, customers, business] = await Promise.all([
    prisma.job.findFirst({ where: { id, businessId } }),
    prisma.customer.findMany({
      where: { businessId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } }),
  ]);
  if (!job) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href={`/jobs/${job.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 min-h-[44px] px-2 -ml-2"
      >
        <ArrowLeft size={14} /> {T('jobBackToJob')}
      </Link>

      <PageHeader title={T('jobEditTitle')} subtitle={job.title} />

      <Card className="p-5 md:p-6">
        <JobForm
          customers={customers}
          locale={locale}
          currency={business?.currency}
          initial={{
            id: job.id,
            title: job.title,
            customerId: job.customerId,
            date: toISODateLocal(job.date),
            time: job.time,
            address: job.address,
            price: job.price,
            notes: job.notes,
            technician: job.technician,
          }}
          action={updateJob}
          submitLabel={t(locale, 'common.save')}
        />
      </Card>
    </div>
  );
}
