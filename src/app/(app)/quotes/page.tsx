import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, ClipboardList } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, StatusBadge, EmptyState } from '@/components/ui';
import { formatDateShort, cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { QUOTE_STATUSES } from '@/lib/validations';

const FILTERS = ['ALL', ...QUOTE_STATUSES] as const;

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  const businessId = session.user.businessId;

  const { status } = await searchParams;
  const activeFilter = FILTERS.includes(status as (typeof FILTERS)[number])
    ? (status as (typeof FILTERS)[number])
    : 'ALL';

  const [business, quotes] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } }),
    prisma.quote.findMany({
      where: {
        businessId,
        ...(activeFilter !== 'ALL' ? { status: activeFilter } : {}),
      },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const pipelineTotal = quotes
    .filter((q) => q.status === 'SENT' || q.status === 'APPROVED')
    .reduce((s, q) => s + q.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotes"
        subtitle={`${quotes.length} quote${quotes.length === 1 ? '' : 's'} · ${formatMoney(pipelineTotal, business?.currency)} in open pipeline`}
        actions={
          <Link
            href="/quotes/new"
            className="bg-[#6329d4] hover:bg-[#5221b3] text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm"
          >
            <Plus size={14} /> New quote
          </Link>
        }
      />

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === 'ALL' ? '/quotes' : `/quotes?status=${f}`}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors',
              activeFilter === f
                ? 'bg-[#6329d4] text-white border-[#6329d4]'
                : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
            )}
          >
            {f}
          </Link>
        ))}
      </div>

      {quotes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList size={24} />}
            title="No quotes yet"
            description="Send your first quote in under a minute — line items in, a clean total out."
            action={
              <Link
                href="/quotes/new"
                className="bg-[#6329d4] hover:bg-[#5221b3] text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2"
              >
                <Plus size={14} /> New quote
              </Link>
            }
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-zinc-100">
            {quotes.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/quotes/${q.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">
                      {q.number} · {q.title}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {q.customer.name} · {formatDateShort(q.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-zinc-900">{formatMoney(q.total, business?.currency)}</span>
                    <StatusBadge status={q.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
