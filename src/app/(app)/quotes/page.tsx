import Link from 'next/link';
import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import { Plus, ClipboardList } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, StatusBadge, EmptyState, primaryBtnClass } from '@/components/ui';
import { formatDateShort, cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { QUOTE_STATUSES } from '@/lib/validations';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import ExportButtons, { type ExportColumn, type ExportRow } from '@/components/ExportButtons';

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
  const locale: Locale = await getLocale();

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

  // Export the *currently filtered* list (2026-09-24).
  const exportColumns: ExportColumn[] = [
    { key: 'number', label: t(locale, 'exports.colNumber') },
    { key: 'title', label: t(locale, 'exports.colTitle') },
    { key: 'customer', label: t(locale, 'exports.colCustomer') },
    { key: 'date', label: t(locale, 'exports.colDate') },
    { key: 'status', label: t(locale, 'exports.colStatus') },
    { key: 'total', label: t(locale, 'exports.colTotal'), kind: 'money' },
  ];
  const exportRows: ExportRow[] = quotes.map((q) => ({
    number: q.number,
    title: q.title,
    customer: q.customer.name,
    date: formatDateShort(q.createdAt),
    status: q.status,
    total: q.total,
  }));
  const exportFileBase = `everyjob-quotes-${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotes"
        subtitle={`${quotes.length} quote${quotes.length === 1 ? '' : 's'} · ${formatMoney(pipelineTotal, business?.currency)} in open pipeline`}
        actions={
          <>
            <ExportButtons
              columns={exportColumns}
              rows={exportRows}
              fileBase={exportFileBase}
              currency={business?.currency}
              locale={locale}
            />
            <Link href="/quotes/new" className={primaryBtnClass}>
              <Plus size={14} /> New quote
            </Link>
          </>
        }
      />

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === 'ALL' ? '/quotes' : `/quotes?status=${f}`}
            aria-current={activeFilter === f ? 'page' : undefined}
            className={cn(
              'min-h-[44px] inline-flex items-center px-4 rounded-full text-xs font-semibold border transition-colors',
              activeFilter === f
                ? 'bg-ink text-white border-ink'
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
              <Link href="/quotes/new" className={primaryBtnClass}>
                <Plus size={14} /> New quote
              </Link>
            }
          />
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <ul className="divide-y divide-zinc-100">
            {quotes.map((q, i) => (
              <li
                key={q.id}
                className="ej-row-in"
                style={{ '--row-delay': `${Math.min(i, 12) * 35}ms` } as CSSProperties}
              >
                <Link
                  href={`/quotes/${q.id}`}
                  className="flex items-center justify-between gap-4 px-4 sm:px-5 py-4 hover:bg-zinc-50 active:bg-zinc-100 transition-colors min-h-[76px]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">
                      {q.number} · {q.title}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {q.customer.name} · {formatDateShort(q.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
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
