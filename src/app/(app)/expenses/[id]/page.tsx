import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Receipt, Pencil, Trash2 } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import ExpenseForm, { type ExpenseFormInitial } from '@/components/ExpenseForm';
import DeleteExpenseButton from '@/components/DeleteExpenseButton';
import { formatMoney, centsToDollars } from '@/lib/money';
import { formatDateShort } from '@/lib/utils';
import { toDateInputValue } from '@/lib/timesheets';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';

export const metadata = { title: 'Expense | EveryJob' };

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const T = (k: string) => t(locale, `expenses.${k}` as never);
  const { id } = await params;

  const expense = await prisma.jobExpense.findFirst({
    where: { id, businessId },
    include: { job: { select: { id: true, title: true } } },
  });
  if (!expense) notFound();

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { currency: true },
  });
  const currency = business?.currency;

  const jobs = await prisma.job.findMany({
    where: { businessId },
    select: { id: true, title: true, date: true },
    orderBy: { date: 'desc' },
    take: 100,
  });

  const initial: ExpenseFormInitial = {
    id: expense.id,
    description: expense.description,
    amount: centsToDollars(expense.amountCents),
    category: expense.category,
    spentAt: toDateInputValue(expense.spentAt),
    jobId: expense.jobId,
    note: expense.note,
    receiptUrl: expense.receiptUrl,
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/expenses"
        className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-500 hover:text-zinc-800"
      >
        <ChevronLeft size={16} /> {T('back')}
      </Link>

      <PageHeader
        title={T('editTitle')}
        subtitle={`${formatMoney(centsToDollars(expense.amountCents), currency)} · ${formatDateShort(
          expense.spentAt.toISOString(),
          locale as Locale
        )}`}
        actions={<DeleteExpenseButton id={expense.id} locale={locale} />}
      />

      {expense.job && (
        <Card className="p-4">
          <p className="text-xs font-semibold text-zinc-500 mb-1">{T('linkedJob')}</p>
          <Link
            href={`/jobs/${expense.job.id}`}
            className="text-sm font-bold text-ink hover:underline"
          >
            {expense.job.title}
          </Link>
        </Card>
      )}

      <ExpenseForm
        locale={locale}
        jobs={jobs.map((j) => ({ id: j.id, title: j.title, date: j.date.toISOString() }))}
        initial={initial}
      />
    </div>
  );
}
