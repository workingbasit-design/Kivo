import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from '@/components/icons';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card } from '@/components/ui';
import JobForm, { type JobFormInitial } from '@/components/JobForm';
import { createJobWithOfflineFallback } from '@/lib/offline/job-action';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { centsToDollars } from '@/lib/money';

// Always render fresh: the customer list must include customers created
// moments ago (client-side navigation can otherwise reuse a cached render).
export const dynamic = 'force-dynamic';

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; template?: string; date?: string }>;
}) {
  const { businessId } = await requireAuth();
  const { service: serviceParam, template: templateParam, date: dateParam } = await searchParams;
  const locale = await getLocale();

  const customers = await prisma.customer.findMany({
    where: { businessId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const crews = await prisma.crew.findMany({
    where: { businessId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  // "Use in job" from the price book: pre-fill title + price, link the job
  // to the service. Tenant-scoped - another business's service is ignored.
  const initial: JobFormInitial = {};
  if (serviceParam) {
    const service = await prisma.service.findFirst({
      where: { id: serviceParam, businessId },
      select: { id: true, name: true, priceCents: true, description: true },
    });
    if (service) {
      initial.title = service.name;
      initial.price = centsToDollars(service.priceCents);
      initial.serviceId = service.id;
      if (service.description) initial.notes = service.description;
    }
  }

  // "Use as job" from a checklist template: pre-fill title/price/notes and
  // copy the template's checklist items on create. Tenant-scoped.
  if (templateParam) {
    const template = await prisma.checklistTemplate.findFirst({
      where: { id: templateParam, businessId },
      select: { id: true, name: true, priceCents: true, notes: true },
    });
    if (template) {
      initial.title = template.name;
      if (template.priceCents !== null) initial.price = centsToDollars(template.priceCents);
      if (template.notes) initial.notes = template.notes;
      initial.templateId = template.id;
    }
  }

  // Tapping an empty day on Schedule starts a new job with that date
  // prefilled (Part B3). Strict YYYY-MM-DD + real calendar date only -
  // anything else is ignored, never guessed.
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const parsed = new Date(`${dateParam}T00:00:00`);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dateParam) {
      initial.date = dateParam;
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft size={14} /> {t(locale, 'jobs.backToJobs')}
      </Link>

      <PageHeader
        title={t(locale, 'jobs.newJob')}
        subtitle={t(locale, 'jobs.newJobSubtitle')}
      />

      <Card className="p-6">
        {customers.length === 0 ? (
          <div className="space-y-5">
            <div className="bg-warn-bg border border-amber-200 text-amber-800 text-xs font-medium rounded-xl px-4 py-3">
              You don&apos;t have any customers yet. Add the customer inline below -
              they&apos;ll be saved automatically.
            </div>
            <JobForm customers={[]} crews={crews} initial={initial} action={createJobWithOfflineFallback} submitLabel="Create job" />
          </div>
        ) : (
          <JobForm customers={customers} crews={crews} initial={initial} action={createJobWithOfflineFallback} submitLabel="Create job" />
        )}
      </Card>

      {customers.length === 0 && (
        <p className="text-xs text-ink-2">
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
