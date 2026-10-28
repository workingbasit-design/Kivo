import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from '@/components/icons';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { Card } from '@/components/kit';
import JobForm from '@/components/JobForm';
import JobCustomFields from '@/components/JobCustomFields';
import { updateJob } from '@/app/actions/jobs';
import { toISODateLocal } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { centsToDollars } from '@/lib/money';
import { PageTitle } from '../../../_components/PageTitle';

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const T = (k: string) => t(locale, `t10work.${k}`);

  const [job, customers, business, crews, properties] = await Promise.all([
    prisma.job.findFirst({ where: { id, businessId } }),
    prisma.customer.findMany({
      where: { businessId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } }),
    prisma.crew.findMany({
      where: { businessId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.customerProperty.findMany({
      where: { businessId },
      select: { id: true, customerId: true, label: true, address: true, province: true },
      orderBy: { label: 'asc' },
    }),
  ]);
  if (!job) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href={`/jobs/${job.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-ink min-h-[44px] px-2 -ml-2"
      >
        <ArrowLeft size={14} /> {T('jobBackToJob')}
      </Link>

      <PageTitle title={T('jobEditTitle')} summary={job.title} />

      <Card className="p-5 md:p-6">
        <JobForm
          customers={customers}
          crews={crews}
          properties={properties}
          locale={locale}
          currency={business?.currency}
          initial={{
            id: job.id,
            title: job.title,
            customerId: job.customerId,
            date: toISODateLocal(job.date),
            time: job.time,
            address: job.address,
            price: centsToDollars(job.priceCents),
            noCharge: job.noCharge,
            notes: job.notes,
            technician: job.technician,
            crewId: job.crewId,
            propertyId: job.propertyId,
          }}
          action={updateJob}
          submitLabel={t(locale, 'common.save')}
        />
      </Card>

      {/* Slice 6: per-job custom fields, same editor as customers. */}
      <JobCustomFields
        jobId={job.id}
        locale={locale}
        initial={{ defs: [], values: [] }}
        fetchOnMount
      />
    </div>
  );
}
