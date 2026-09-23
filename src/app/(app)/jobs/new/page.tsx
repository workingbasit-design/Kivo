import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card } from '@/components/ui';
import JobForm, { type JobFormInitial } from '@/components/JobForm';
import { createJobWithOfflineFallback } from '@/lib/offline/job-action';

// Always render fresh: the customer list must include customers created
// moments ago (client-side navigation can otherwise reuse a cached render).
export const dynamic = 'force-dynamic';

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; template?: string }>;
}) {
  const { businessId } = await requireAuth();
  const { service: serviceParam, template: templateParam } = await searchParams;

  const customers = await prisma.customer.findMany({
    where: { businessId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  // "Use in job" from the price book: pre-fill title + price, link the job
  // to the service. Tenant-scoped — another business's service is ignored.
  const initial: JobFormInitial = {};
  if (serviceParam) {
    const service = await prisma.service.findFirst({
      where: { id: serviceParam, businessId },
      select: { id: true, name: true, price: true, description: true },
    });
    if (service) {
      initial.title = service.name;
      initial.price = service.price;
      initial.serviceId = service.id;
      if (service.description) initial.notes = service.description;
    }
  }

  // "Use as job" from a checklist template: pre-fill title/price/notes and
  // copy the template's checklist items on create. Tenant-scoped.
  if (templateParam) {
    const template = await prisma.checklistTemplate.findFirst({
      where: { id: templateParam, businessId },
      select: { id: true, name: true, price: true, notes: true },
    });
    if (template) {
      initial.title = template.name;
      if (typeof template.price === 'number') initial.price = template.price;
      if (template.notes) initial.notes = template.notes;
      initial.templateId = template.id;
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft size={14} /> Back to jobs
      </Link>

      <PageHeader
        title="New job"
        subtitle="Fill the essentials — under 20 seconds."
      />

      <Card className="p-6">
        {customers.length === 0 ? (
          <div className="space-y-5">
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium rounded-xl px-4 py-3">
              You don't have any customers yet. Add the customer inline below —
              they'll be saved automatically.
            </div>
            <JobForm customers={[]} initial={initial} action={createJobWithOfflineFallback} submitLabel="Create job" />
          </div>
        ) : (
          <JobForm customers={customers} initial={initial} action={createJobWithOfflineFallback} submitLabel="Create job" />
        )}
      </Card>

      {customers.length === 0 && (
        <p className="text-xs text-zinc-400">
          Tip: you can also add customers properly from the{' '}
          <Link href="/customers" className="text-ink font-semibold hover:underline">
            Customers
          </Link>{' '}
          page.
        </p>
      )}
    </div>
  );
}
