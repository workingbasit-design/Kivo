import Link from 'next/link';
import { Plus, Receipt, Search, X } from '@/components/icons';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

import { formatMoney, centsToDollars } from '@/lib/money';
import { formatDateShort, cn } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import {
  parseExpenseFilters,
  EXPENSE_CATEGORIES,
  isExpenseCategory,
} from '@/lib/expenses';
import { PageHeader, EmptyState, Input, Select, DateField, Button, Card } from '@/components/kit';

export const metadata = { title: 'Expenses | EveryJob' };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; jobId?: string; from?: string; to?: string; q?: string }>;
}) {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const T = (k: string) => t(locale, `expenses.${k}` as never);
  const F = (k: string) => t(locale, `expenses.filters.${k}` as never);

  const filters = parseExpenseFilters(await searchParams);

  const where: Record<string, unknown> = { businessId };
  if (filters.category !== 'ALL') where.category = filters.category;
  if (filters.jobId === 'UNLINKED') where.jobId = null;
  else if (filters.jobId !== 'ALL') where.jobId = filters.jobId;
  if (filters.from || filters.to) {
    where.spentAt = {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00`) } : {}),
      ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59`) } : {}),
    };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { currency: true },
  });
  const currency = business?.currency;

  const [expenses, jobs] = await Promise.all([
    prisma.jobExpense.findMany({
      where,
      include: { job: { select: { id: true, title: true } } },
      orderBy: [{ spentAt: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    }),
    prisma.job.findMany({
      where: { businessId },
      select: { id: true, title: true },
      orderBy: { date: 'desc' },
      take: 100,
    }),
  ]);

  const q = filters.q.toLowerCase();
  const filtered = q
    ? expenses.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          (e.note ?? '').toLowerCase().includes(q) ||
          (e.job?.title ?? '').toLowerCase().includes(q)
      )
    : expenses;

  const total = filtered.reduce((s, e) => s + centsToDollars(e.amountCents), 0);
  const hasFilters =
    filters.category !== 'ALL' ||
    filters.jobId !== 'ALL' ||
    filters.from !== '' ||
    filters.to !== '' ||
    filters.q !== '';

  return (
    <div className="space-y-6">
      <PageHeader
        title={T('title')}
        summary={T('subtitle')}
        actionLabel={T('new')}
        actionHref="/expenses/new"
        actionIcon={Plus}
      />

      {/* Filters */}
      <Card className="p-4 md:p-5">
        <form method="GET" action="/expenses" className="flex flex-col gap-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1 min-w-0">
              <Input
                label={F('search')}
                name="q"
                defaultValue={filters.q}
                placeholder={F('search')}
              />
            </div>
            <Button type="submit" variant="secondary" sm>
              {F('search').split('…')[0]}
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Select
              label={F('category')}
              name="category"
              defaultValue={filters.category}
              options={[
                { value: 'ALL', label: F('all') },
                ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: T(`categories.${c}`) })),
              ]}
            />
            <Select
              label={F('job')}
              name="jobId"
              defaultValue={filters.jobId}
              options={[
                { value: 'ALL', label: F('all') },
                { value: 'UNLINKED', label: F('unlinked') },
                ...jobs.map((j) => ({ value: j.id, label: j.title })),
              ]}
            />
            <DateField label={F('from')} name="from" defaultValue={filters.from} />
            <DateField label={F('to')} name="to" defaultValue={filters.to} />
          </div>
          {hasFilters && (
            <Link
              href="/expenses"
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink self-start"
            >
              <X size={14} /> {F('clear')}
            </Link>
          )}
        </form>
      </Card>

      {/* Total */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-2">
            {filtered.length} {filtered.length === 1 ? 'expense' : 'expenses'}
          </p>
          <p className="text-sm font-bold text-ink tabular-nums">
            {T('total')}: {formatMoney(total, currency)}
          </p>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title={T('empty')}
            text={T('emptyHint')}
          />
<div className="flex justify-center pb-10 -mt-6">
            <Button href="/expenses/new" variant="primary">
              <Plus size={16} /> {T('new')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <Link key={e.id} href={`/expenses/${e.id}`} className="block">
              <Card className="p-4 hover:border-asphalt/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
                    <Receipt size={18} className="text-ink-2" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-ink truncate">{e.description}</p>
                    <p className="text-xs text-ink-2">
                      {formatDateShort(e.spentAt.toISOString(), locale as Locale)} ·{' '}
                      {T(`categories.${isExpenseCategory(e.category) ? e.category : 'OTHER'}`)}
                      {e.job ? ` · ${e.job.title}` : ` · ${T('noJob')}`}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-ink tabular-nums shrink-0">
                    {formatMoney(centsToDollars(e.amountCents), currency)}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
