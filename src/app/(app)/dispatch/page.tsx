import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { dayRange, toISODateLocal, formatDateShort } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { CalendarDays } from 'lucide-react';
import DispatchBoardClient from '@/components/DispatchBoardClient';
import DispatchDatePicker from '@/components/DispatchDatePicker';

export const dynamic = 'force-dynamic';

/**
 * Dispatch board — kanban-style daily dispatch view.
 * Shows today's jobs grouped by status (Scheduled / In Progress / Completed)
 * so dispatchers can see the whole day at a glance. Status changes happen
 * inline via the client component; full job details are one tap away.
 */
export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const T = (k: string) => t(locale, `dispatch.${k}`);

  const { date } = await searchParams;
  const dateStr =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toISODateLocal(new Date());
  const { gte, lte } = dayRange(dateStr);

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { currency: true, timezone: true },
  });

  const jobs = await prisma.job.findMany({
    where: {
      businessId,
      date: { gte, lt: lte },
      status: { not: 'CANCELLED' },
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
  });

  const team = await prisma.user.findMany({
    where: { businessId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const serialized = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    time: j.time,
    status: j.status,
    price: j.price,
    address: j.address,
    technician: j.technician,
    assignedToId: j.assignedToId,
    assignedToName: j.assignedTo?.name ?? null,
    customerName: j.customer.name,
    customerPhone: j.customer.phone,
    customerId: j.customer.id,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={T('title')}
        subtitle={formatDateShort(new Date(dateStr + 'T12:00:00'))}
        actions={<DispatchDatePicker currentDate={dateStr} label={T('selectDate')} />}
      />
      {jobs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays size={24} />}
            title={T('emptyTitle')}
            description={T('emptyDesc')}
            action={
              <Link href="/jobs/new" className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-graphite min-h-[44px]">
                {T('newJob')}
              </Link>
            }
          />
        </Card>
      ) : (
        <DispatchBoardClient
          jobs={serialized}
          team={team}
          currency={business?.currency}
          locale={locale}
        />
      )}
    </div>
  );
}
