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

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { businessId } = await requireAuth();

  const [job, customers] = await Promise.all([
    prisma.job.findFirst({ where: { id, businessId } }),
    prisma.customer.findMany({
      where: { businessId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  if (!job) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href={`/jobs/${job.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft size={14} /> Back to job
      </Link>

      <PageHeader title="Edit job" subtitle={job.title} />

      <Card className="p-6">
        <JobForm
          customers={customers}
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
          submitLabel="Save changes"
        />
      </Card>
    </div>
  );
}
