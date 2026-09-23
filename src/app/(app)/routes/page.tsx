import React from 'react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card, EmptyState, limeBtnClass, inputClass, Field } from '@/components/ui';
import { dayRange, toISODateLocal, formatDateLabel, localeDateTag } from '@/lib/utils';
import { MapPinned } from 'lucide-react';
import RoutesClient from '@/components/RoutesClient';
import type { RouteStop } from '@/lib/routes';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

const ROUTE_STATUSES = ['SCHEDULED', 'IN PROGRESS'];

export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const T = (k: string) => t(locale, `t10work.${k}`);
  const dateLocale = localeDateTag(locale);
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
    <div className="space-y-5">
      <PageHeader
        title={T('routesTitle')}
        subtitle={T('routesSubtitle').replace('{date}', formatDateLabel(dateStr, dateLocale))}
      />

      {stops.length === 0 ? (
        <Card>
          <form method="GET" action="/routes" className="px-5 pt-5">
            <div className="flex items-end gap-2 max-w-md">
              <div className="flex-1">
                <Field label={T('routesDay')}>
                  <input
                    id="route-date-empty"
                    type="date"
                    name="date"
                    defaultValue={dateStr}
                    className={inputClass}
                    aria-label={T('routesRouteDate')}
                  />
                </Field>
              </div>
              <button
                type="submit"
                className="bg-zinc-900 hover:bg-zinc-700 text-white min-h-[44px] px-5 rounded-xl font-semibold text-xs transition-colors"
              >
                {T('routesShow')}
              </button>
            </div>
          </form>
          <EmptyState
            icon={<MapPinned size={24} />}
            title={T('routesEmptyTitle')}
            description={T('routesEmptyDesc')}
            action={
              <a href="/schedule" className={limeBtnClass}>
                {T('routesGoSchedule')}
              </a>
            }
          />
        </Card>
      ) : (
        <RoutesClient
          key={dateStr}
          initialStops={stops}
          dateStr={dateStr}
          currency={currency}
          locale={locale}
          fullRouteLabel={t(locale, 'quotes.route.openFullRoute')}
        />
      )}
    </div>
  );
}
