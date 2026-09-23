import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card } from '@/components/ui';
import JobForm from '@/components/JobForm';
import { createJobWithOfflineFallback } from '@/lib/offline/job-action';

// Always render fresh: the customer list must include customers created
// moments ago (client-side navigation can otherwise reuse a cached render).
export const dynamic = 'force-dynamic';

export default async function NewJobPage() {
  const { businessId } = await requireAuth();

  const customers = await prisma.customer.findMany({
    where: { businessId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

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
            <JobForm customers={[]} action={createJobWithOfflineFallback} submitLabel="Create job" />
          </div>
        ) : (
          <JobForm customers={customers} action={createJobWithOfflineFallback} submitLabel="Create job" />
        )}
      </Card>

      {customers.length === 0 && (
        <p className="text-xs text-zinc-400">
          Tip: you can also add customers properly from the{' '}
          <Link href="/customers" className="text-[#6329d4] font-semibold hover:underline">
            Customers
          </Link>{' '}
          page.
        </p>
      )}
    </div>
  );
}
