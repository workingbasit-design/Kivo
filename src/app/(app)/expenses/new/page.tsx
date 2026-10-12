import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import ExpenseForm from '@/components/ExpenseForm';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

export const metadata = { title: 'New expense | EveryJob' };

export default async function NewExpensePage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const T = (k: string) => t(locale, `expenses.${k}` as never);

  const jobs = await prisma.job.findMany({
    where: { businessId },
    select: { id: true, title: true, date: true },
    orderBy: { date: 'desc' },
    take: 100,
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/expenses"
        className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-500 hover:text-zinc-800"
      >
        <ChevronLeft size={16} /> {T('back')}
      </Link>
      <PageHeader title={T('newTitle')} subtitle={T('newSubtitle')} />
      <ExpenseForm
        locale={locale}
        jobs={jobs.map((j) => ({ id: j.id, title: j.title, date: j.date.toISOString() }))}
      />
    </div>
  );
}
