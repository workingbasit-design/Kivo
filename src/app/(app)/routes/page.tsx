import React from 'react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { dayRange, toISODateLocal, formatDateLabel } from '@/lib/utils';
import { MapPinned } from 'lucide-react';
import RoutesClient from '@/components/RoutesClient';
import { inputClass } from '@/components/ui';
import type { RouteStop } from '@/lib/routes';

const ROUTE_STATUSES = ['SCHEDULED', 'IN PROGRESS'];

export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { businessId } = await requireAuth();
  const __biz = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = __biz?.currency;
  const { date } = await searchParams;

  const dateStr =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toISODateLocal(new Date());
  const { gte, lte } = dayRange(dateStr);

  const jobs = await prisma.job.findMany({
    where: {
      businessId,
      date: { gte, lte },
      status: { in: ROUTE_STATUSES },
    },
    include: { customer: { select: { name: true } } },
    orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
  });

  const stops: RouteStop[] = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    customerName: j.customer.name,
    address: j.address,
    time: j.time,
    price: j.price,
    status: j.status,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Route planner"
        subtitle={`Jobs for ${formatDateLabel(dateStr)}`}
      />

      {stops.length === 0 ? (
        <Card>
          <form method="GET" action="/routes" className="flex items-center gap-2 px-6 pt-6">
            <label htmlFor="route-date-empty" className="text-xs font-semibold text-zinc-500">
              Day:
            </label>
            <input
              id="route-date-empty"
              type="date"
              name="date"
              defaultValue={dateStr}
              className={inputClass + ' w-auto'}
              aria-label="Route date"
            />
            <button
              type="submit"
              className="bg-zinc-900 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors"
            >
              Show
            </button>
          </form>
          <EmptyState
            icon={<MapPinned size={24} />}
            title="No stops on this day"
            description="Pick a day with scheduled jobs, then hit “Optimize route” to compute the best visit order from real driving data."
            action={
              <a
                href="/schedule"
                className="bg-[#6329d4] hover:bg-[#5221b3] text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm"
              >
                Go to schedule
              </a>
            }
          />
        </Card>
      ) : (
        <RoutesClient key={dateStr} initialStops={stops} dateStr={dateStr} currency={currency} />
      )}
    </div>
  );
}
