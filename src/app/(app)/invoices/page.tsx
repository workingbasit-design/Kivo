import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, FileText, Wallet, Receipt } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, StatusBadge, EmptyState, StatCard } from '@/components/ui';
import { formatDateShort, cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { INVOICE_STATUSES } from '@/lib/validations';

const FILTERS = ['ALL', ...INVOICE_STATUSES] as const;

export default async function InvoicesPage({
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
  const locale = await getLocale();

  const [business, invoices, aggregates] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } }),
    prisma.invoice.findMany({
      where: {
        businessId,
        ...(activeFilter !== 'ALL' ? { status: activeFilter } : {}),
      },
      include: {
        customer: { select: { name: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.findMany({
      where: { businessId },
      select: { total: true, status: true, payments: { select: { amount: true } } },
    }),
  ]);

  const outstanding = aggregates
    .filter((i) => i.status !== 'PAID')
    .reduce(
      (s, i) => s + (i.total - i.payments.reduce((p, pay) => p + pay.amount, 0)),
      0
    );
  const collected = aggregates.reduce(
    (s, i) => s + i.payments.reduce((p, pay) => p + pay.amount, 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Every payment, accounted for."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/invoices/batch"
              className="bg-white hover:bg-zinc-50 text-zinc-700 px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 border border-zinc-200 shadow-sm"
            >
              <Receipt size={14} /> {t(locale, 'billing.batchTitle')}
            </Link>
            <Link
              href="/invoices/new"
              className="bg-ink hover:bg-graphite text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm"
            >
              <Plus size={14} /> New invoice
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Outstanding"
          value={formatMoney(Math.round(outstanding * 100) / 100, business?.currency)}
          sub="yet to be collected"
          icon={<Wallet size={16} />}
          accent="bg-amber-100 text-amber-700"
        />
        <StatCard
          label="Collected"
          value={formatMoney(Math.round(collected * 100) / 100, business?.currency)}
          sub="payments recorded"
          icon={<FileText size={16} />}
          accent="bg-emerald-100 text-emerald-700"
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === 'ALL' ? '/invoices' : `/invoices?status=${encodeURIComponent(f)}`}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors',
              activeFilter === f
                ? 'bg-ink text-white border-ink'
                : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
            )}
          >
            {f}
          </Link>
        ))}
      </div>

      {invoices.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText size={24} />}
            title="No invoices yet"
            description="Raise a GST-ready invoice in under a minute — tax math handled for you."
            action={
              <Link
                href="/invoices/new"
                className="bg-ink hover:bg-graphite text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2"
              >
                <Plus size={14} /> New invoice
              </Link>
            }
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-zinc-100">
            {invoices.map((inv) => {
              const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
              const due = Math.round((inv.total - paid) * 100) / 100;
              return (
                <li key={inv.id}>
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        {inv.number} · {inv.customer.name}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {formatDateShort(inv.date)}
                        {due > 0 && inv.status !== 'PAID' && (
                          <span className="text-amber-700 font-semibold"> · {formatMoney(due, business?.currency)} due</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold text-zinc-900">{formatMoney(inv.total, business?.currency)}</span>
                      <StatusBadge status={inv.status} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
