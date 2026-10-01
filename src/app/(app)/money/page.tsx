import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, ClipboardList, FileText, ArrowRight, BellRing } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import SmsButton from '@/components/SmsButton';
import WhatsAppButton from '@/components/WhatsAppButton';
import { fillTemplate, daysOverdue, remainingBalance, OVERDUE_AFTER_DAYS, DAY_MS } from '@/lib/revenue';

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

  const [business, openQuotes, unpaidInvoices, overdueInvoices] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { currency: true, name: true, regionCode: true, timezone: true },
    }),
    prisma.quote.findMany({
      where: { businessId, status: 'SENT' },
      select: { total: true },
    }),
    prisma.invoice.findMany({
      where: { businessId, status: { not: 'PAID' } },
      select: { total: true, payments: { select: { amount: true } } },
    }),
    // Overdue queue: unpaid/partially-paid invoices older than Net-30, oldest first.
    prisma.invoice.findMany({
      where: {
        businessId,
        status: { not: 'PAID' },
        date: { lt: new Date(Date.now() - OVERDUE_AFTER_DAYS * DAY_MS) },
      },
      select: {
        id: true,
        number: true,
        total: true,
        date: true,
        customer: { select: { name: true, phone: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { date: 'asc' },
      take: 10,
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

      {/* Overdue-invoice reminder queue — revenue recovery.
          EveryJob never sends anything itself: SmsButton/WhatsAppButton only
          open the user's own apps with the message prefilled. */}
      {overdueInvoices.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <BellRing className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 className="font-semibold">{L('t10money.reminders.title')}</h2>
                <p className="text-xs text-[var(--ej-muted)]">{L('t10money.reminders.desc')}</p>
              </div>
            </div>
          </div>
          <ul className="divide-y divide-zinc-100">
            {overdueInvoices.map((inv) => {
              const remaining = remainingBalance(
                inv.total,
                inv.payments.map((p) => p.amount)
              );
              // Overdue badge flips at local midnight in the business's timezone.
              const overdueDays = Math.max(1, daysOverdue(new Date(inv.date), new Date(), business?.timezone));
              const message = fillTemplate(L('t10money.reminders.message'), {
                customerName: inv.customer.name,
                businessName: business?.name ?? '',
                number: inv.number,
                amount: formatMoney(remaining, business?.currency),
                days: overdueDays,
                invoiceLink: `/invoices/${inv.id}`,
              });
              return (
                <li key={inv.id} className="px-4 sm:px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        <Link href={`/invoices/${inv.id}`} className="hover:underline">
                          {inv.number}
                        </Link>
                        <span className="font-normal text-zinc-500"> · {inv.customer.name}</span>
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        <span className="font-semibold text-amber-700">
                          {L('t10money.reminders.daysOverdue').replace('{days}', String(overdueDays))}
                        </span>
                        {' · '}
                        {L('t10money.reminders.balanceDue')}: {formatMoney(remaining, business?.currency)}
                      </p>
                    </div>
                  </div>
                  <details className="mt-2 group">
                    <summary className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-sky-700 hover:underline min-h-[32px]">
                      {L('t10money.reminders.sendReminder')}
                    </summary>
                    <div className="mt-2 rounded-xl bg-zinc-50 border border-zinc-200 p-3 space-y-3">
                      <p className="text-xs text-zinc-700 whitespace-pre-wrap">{message}</p>
                      {inv.customer.phone ? (
                        <div className="flex flex-wrap gap-2">
                          <SmsButton
                            phone={inv.customer.phone}
                            regionCode={business?.regionCode}
                            message={message}
                            label={L('t10money.reminders.smsLabel')}
                          />
                          <WhatsAppButton
                            phone={inv.customer.phone}
                            regionCode={business?.regionCode}
                            message={message}
                            label={L('t10money.reminders.waLabel')}
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500">{L('t10money.reminders.noPhone')}</p>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
