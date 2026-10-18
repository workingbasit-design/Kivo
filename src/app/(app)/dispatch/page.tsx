import React from 'react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { Card, EmptyState, Button } from '@/components/kit';
import { PageTitle } from '../_components/PageTitle';
import { dayRange, toISODateLocal, formatDateShort } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { CalendarDays } from '@/components/icons';
import DispatchBoardClient from '@/components/DispatchBoardClient';
import DispatchDatePicker from '@/components/DispatchDatePicker';
import { centsToDollars } from '@/lib/money';

export const dynamic = 'force-dynamic';

/**
 * Dispatch board - kanban-style daily dispatch view.
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

  const team = (
    await prisma.membership.findMany({
      where: { businessId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: 'asc' } },
    })
  ).map((m) => m.user);

  const serialized = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    time: j.time,
    status: j.status,
    price: centsToDollars(j.priceCents),
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
      <PageTitle
        title={T('title')}
        summary={formatDateShort(new Date(dateStr + 'T12:00:00'))}
      />
      <div className="flex flex-wrap gap-2">
        <DispatchDatePicker currentDate={dateStr} label={T('selectDate')} />
      </div>
      {jobs.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarDays}
            title={T('emptyTitle')}
            text={T('emptyDesc')}
          />
          <div className="flex justify-center pb-10 -mt-6">
            <Button href="/jobs/new" variant="primary" sm>
              {T('newJob')}
            </Button>
          </div>
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
