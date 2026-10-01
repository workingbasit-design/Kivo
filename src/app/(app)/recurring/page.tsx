import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import RecurringClient, { type RecurringPlanItem } from './RecurringClient';

type Filter = 'ALL' | 'active' | 'paused';

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { businessId } = await requireAuth();
  const { filter } = await searchParams;
  const locale = await getLocale();
  const initialFilter: Filter =
    filter === 'paused' ? 'paused' : filter === 'active' ? 'active' : 'ALL';

  // One fetch for everything: tab switching filters in memory on the client,
  // so switching tabs never hits the server.
  const [business, planRows, dueCount] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } }),
    prisma.recurringJob.findMany({
      where: { businessId },
      include: {
        customer: { select: { id: true, name: true } },
        _count: { select: { jobs: true } },
      },
      orderBy: { nextRun: 'asc' },
    }),
    prisma.recurringJob.count({
      where: { businessId, active: true, nextRun: { lte: new Date() } },
    }),
  ]);

  const plans: RecurringPlanItem[] = planRows.map((plan) => ({
    id: plan.id,
    title: plan.title,
    frequency: plan.frequency,
    price: plan.price,
    active: plan.active,
    nextRun: plan.nextRun.toISOString(),
    time: plan.time,
    address: plan.address,
    customer: { id: plan.customer.id, name: plan.customer.name },
    jobCount: plan._count.jobs,
  }));

  return (
    <RecurringClient
      plans={plans}
      dueCount={dueCount}
      currency={business?.currency}
      locale={locale}
      initialFilter={initialFilter}
    />
  );
}
