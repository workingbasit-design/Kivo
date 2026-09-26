import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, ClipboardList, FileText, ArrowRight } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import { formatMoney } from '@/lib/money';

/**
 * Money hub (Phase 1): a simple overview of what's outstanding.
 * Tenant-scoped open-quote value + unpaid-invoice balance, with links
 * into /quotes and /invoices. Reachable from the mobile bottom bar.
 */
export default async function MoneyPage() {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  const businessId = session.user.businessId;
  const locale = await getLocale();
  const L = (path: string) => t(locale, path);

  const [business, openQuotes, unpaidInvoices] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } }),
    prisma.quote.findMany({
      where: { businessId, status: 'SENT' },
      select: { total: true },
    }),
    prisma.invoice.findMany({
      where: { businessId, status: { not: 'PAID' } },
      select: { total: true, payments: { select: { amount: true } } },
    }),
  ]);

  const currency = business?.currency;
  const openQuoteValue = openQuotes.reduce((s, q) => s + q.total, 0);
  const unpaidBalance = unpaidInvoices.reduce(
    (s, i) => s + (i.total - i.payments.reduce((p, pay) => p + pay.amount, 0)),
    0,
  );
  const allCaughtUp = openQuotes.length === 0 && unpaidInvoices.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={L('t10money.money.title')} subtitle={L('t10money.money.subtitle')} />

      {allCaughtUp && (
        <Card className="p-6 text-center text-[var(--ej-muted)]">
          {L('t10money.money.allCaughtUp')}
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ej-primary-soft)] text-[var(--ej-primary)]">
              <ClipboardList className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-semibold">{L('t10money.money.quotesCardTitle')}</h2>
              <p className="text-sm text-[var(--ej-muted)]">{L('t10money.money.quotesCardDesc')}</p>
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold tabular-nums">
            {formatMoney(Math.round(openQuoteValue * 100) / 100, currency)}
          </p>
          <p className="mt-1 text-sm text-[var(--ej-muted)]">
            {openQuotes.length === 0
              ? L('t10money.money.noQuotesYet')
              : L('t10money.money.quotesCount').replace('{count}', String(openQuotes.length))}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/quotes" className={secondaryBtnClass}>
              {L('t10money.money.viewQuotes')}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/quotes/new" className={primaryBtnClass}>
              <Plus className="h-4 w-4" aria-hidden />
              {L('t10money.money.newQuote')}
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ej-primary-soft)] text-[var(--ej-primary)]">
              <FileText className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-semibold">{L('t10money.money.invoicesCardTitle')}</h2>
              <p className="text-sm text-[var(--ej-muted)]">{L('t10money.money.invoicesCardDesc')}</p>
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold tabular-nums">
            {formatMoney(Math.round(unpaidBalance * 100) / 100, currency)}
          </p>
          <p className="mt-1 text-sm text-[var(--ej-muted)]">
            {unpaidInvoices.length === 0
              ? L('t10money.money.noInvoicesYet')
              : L('t10money.money.invoicesCount').replace('{count}', String(unpaidInvoices.length))}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/invoices" className={secondaryBtnClass}>
              {L('t10money.money.viewInvoices')}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/invoices/new" className={primaryBtnClass}>
              <Plus className="h-4 w-4" aria-hidden />
              {L('t10money.money.newInvoice')}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
