import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { centsToDollars } from '@/lib/money';
import RecurringClient, { type RecurringPlanItem } from './RecurringClient';
import { parseListLimit, takeWithProbe, sliceListPage } from '@/lib/list-page';
import { ListMore } from '../_components/ListMore';

type Filter = 'ALL' | 'active' | 'paused';

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; limit?: string }>;
}) {
  const { businessId } = await requireAuth();
  const { filter, limit: limitRaw } = await searchParams;
  const locale = await getLocale();
  const limit = parseListLimit(limitRaw);
  const initialFilter: Filter =
    filter === 'paused' ? 'paused' : filter === 'active' ? 'active' : 'ALL';

  // One fetch for everything: tab switching filters in memory on the client,
  // so switching tabs never hits the server. M3: the fetch is bounded; the
  // due count already comes from the database.
  const [business, fetched, dueCount, total] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } }),
    prisma.recurringJob.findMany({
      where: { businessId },
      include: {
        customer: { select: { id: true, name: true } },
        _count: { select: { jobs: true } },
      },
      orderBy: { nextRun: 'asc' },
      take: takeWithProbe(limit),
    }),
    prisma.recurringJob.count({
      where: { businessId, active: true, nextRun: { lte: new Date() } },
    }),
    prisma.recurringJob.count({ where: { businessId } }),
  ]);
  const page = sliceListPage(fetched, limit);
  const planRows = page.rows;

  const plans: RecurringPlanItem[] = planRows.map((plan) => ({
    id: plan.id,
    title: plan.title,
    frequency: plan.frequency,
    price: centsToDollars(plan.priceCents),
    active: plan.active,
    nextRun: plan.nextRun.toISOString(),
    time: plan.time,
    address: plan.address,
    customer: { id: plan.customer.id, name: plan.customer.name },
    jobCount: plan._count.jobs,
    invoiceSchedule: plan.invoiceSchedule,
    invoiceDayOfMonth: plan.invoiceDayOfMonth,
  }));

  return (
    <>
      <RecurringClient
        plans={plans}
        dueCount={dueCount}
        currency={business?.currency}
        locale={locale}
        initialFilter={initialFilter}
      />
      <ListMore
        shown={plans.length}
        total={total}
        nextLimit={page.nextLimit}
        locale={locale}
        basePath="/recurring"
        params={{ filter }}
      />
    </>
  );
}
