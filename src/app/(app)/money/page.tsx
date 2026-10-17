import Link from 'next/link';
import { Plus, FileText, Clock, Hourglass } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import { ListRow, SectionHeader } from '@/components/design/lists';
import { EmptyState } from '@/components/design/feedback';
import MoneyText from '@/components/MoneyText';
import { formatMoney, centsToDollars } from '@/lib/money';
import { daysOverdue, remainingBalance, OVERDUE_AFTER_DAYS, DAY_MS } from '@/lib/revenue';
import { formatDisplayDate } from '@/lib/attention';

/**
 * "Now" for overdue-threshold math. A plain module helper (not a component),
 * so it evaluates fresh on every request without tripping render-purity rules.
 */
function overdueThreshold(): Date {
  return new Date(Date.now() - OVERDUE_AFTER_DAYS * DAY_MS);
}

/**
 * "Now" snapshot for waiting-day math. A plain module helper (not a component),
 * so it evaluates fresh on every request without tripping render-purity rules.
 */
function requestNowMs(): number {
  return Date.now();
}

/**
 * Money hub (Part E4): three lists, not stat cards.
 * 1. Ready to invoice — completed jobs with no invoice yet
 * 2. Awaiting payment — unpaid/partially-paid invoices, oldest first
 * 3. Awaiting a decision — sent quotes waiting on the customer
 *
 * Each section shows its items with amounts and one-tap actions.
 * No giant $0.00 numbers. Empty sections show a compact empty state.
 */
export default async function MoneyPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const L = (path: string) => t(locale, path);

  const [business, openQuotes, unpaidInvoices, unbilledJobs] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { currency: true, name: true, regionCode: true, timezone: true },
    }),
    // Awaiting a decision: sent quotes, oldest first (longest waiting on top).
    prisma.quote.findMany({
      where: { businessId, status: 'SENT' },
      select: {
        id: true,
        number: true,
        title: true,
        totalCents: true,
        updatedAt: true,
        customer: { select: { name: true } },
      },
      orderBy: { updatedAt: 'asc' },
      take: 10,
    }),
    // Awaiting payment: unpaid/partially-paid invoices, oldest first.
    // Excludes voided invoices.
    prisma.invoice.findMany({
      where: {
        businessId,
        status: { not: 'PAID' },
        voidedAt: null,
      },
      select: {
        id: true,
        number: true,
        totalCents: true,
        date: true,
        customer: { select: { name: true, phone: true } },
        payments: { select: { amountCents: true } },
      },
      orderBy: { date: 'asc' },
      take: 10,
    }),
    // Ready to invoice: completed jobs with no invoice yet - the most common
    // cash leak for small trades. Uses the invoice relation (not invoicedAt,
    // which is never cleared when a draft invoice is deleted).
    prisma.job.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        invoices: { none: {} },
      },
      select: {
        id: true,
        title: true,
        date: true,
        priceCents: true,
        noCharge: true,
        customer: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
      take: 10,
    }),
  ]);

  const readyTotal = unbilledJobs.reduce(
    (s, j) => s + (j.noCharge || j.priceCents == null ? 0 : centsToDollars(j.priceCents)),
    0
  );
  const awaitingTotal = unpaidInvoices.reduce((s, inv) => {
    const remaining = remainingBalance(
      centsToDollars(inv.totalCents),
      inv.payments.map((p) => centsToDollars(p.amountCents))
    );
    return s + remaining;
  }, 0);
  const decisionTotal = openQuotes.reduce((s, q) => s + centsToDollars(q.totalCents), 0);

  const allCaughtUp =
    unbilledJobs.length === 0 && unpaidInvoices.length === 0 && openQuotes.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={L('t10money.money.title')}
        subtitle={L('t10money.money.subtitle')}
        actions={
          <Link href="/invoices/new" className={primaryBtnClass}>
            <Plus className="h-4 w-4" aria-hidden />
            {L('t10money.money.newInvoice')}
          </Link>
        }
      />

      {allCaughtUp ? (
        <Card>
          <EmptyState
            title={L('t10money.money.emptyTitle')}
            description={L('t10money.money.emptyDesc')}
            action={
              <Link href="/invoices/new" className={primaryBtnClass}>
                <Plus className="h-4 w-4" aria-hidden />
                {L('t10money.money.newInvoice')}
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {/* 1. Ready to invoice — completed jobs with no invoice yet. */}
          <section aria-labelledby="ready-to-invoice">
            <SectionHeader
              title={`${L('t10money.money.unbilledTitle')} (${unbilledJobs.length})`}
              action={
                unbilledJobs.length > 0 ? (
                  <span className="text-base font-bold tabular-nums text-ej-ink">
                    <MoneyText dollars={readyTotal} locale={locale} />
                  </span>
                ) : undefined
              }
            />
            {unbilledJobs.length === 0 ? (
              <p className="text-sm text-ej-muted px-1">
                {L('t10money.money.noUnbilled')}
              </p>
            ) : (
              <Card className="!p-0 overflow-hidden">
                <ul className="divide-y divide-ej-border">
                  {unbilledJobs.map((j) => (
                    <ListRow
                      key={j.id}
                      title={j.title}
                      subtitle={`${j.customer.name} · ${L('t10money.money.completedOn')} ${formatDisplayDate(new Date(j.date), business?.timezone, locale)}`}
                      trailing={
                        j.noCharge ? (
                          <span className="text-sm text-ej-muted">{L('t10money.money.noCharge')}</span>
                        ) : (
                          <MoneyText
                            dollars={j.priceCents != null ? centsToDollars(j.priceCents) : null}
                            locale={locale}
                          />
                        )
                      }
                      href={`/jobs/${j.id}`}
                      menuLabel={L('t10money.money.jobActions').replace('{title}', j.title)}
                    />
                  ))}
                </ul>
              </Card>
            )}
            {unbilledJobs.length > 0 && (
              <p className="mt-2 text-xs text-ej-muted px-1">{L('t10money.money.unbilledDesc')}</p>
            )}
          </section>

          {/* 2. Awaiting payment — unpaid invoices, oldest first. */}
          <section aria-labelledby="awaiting-payment">
            <SectionHeader
              title={`${L('t10money.money.invoicesCardTitle')} (${unpaidInvoices.length})`}
              action={
                unpaidInvoices.length > 0 ? (
                  <span className="text-base font-bold tabular-nums text-ej-ink">
                    <MoneyText dollars={awaitingTotal} locale={locale} />
                  </span>
                ) : undefined
              }
            />
            {unpaidInvoices.length === 0 ? (
              <p className="text-sm text-ej-muted px-1">
                {L('t10money.money.noInvoicesYet')}
              </p>
            ) : (
              <Card className="!p-0 overflow-hidden">
                <ul className="divide-y divide-ej-border">
                  {unpaidInvoices.map((inv) => {
                    const remaining = remainingBalance(
                      centsToDollars(inv.totalCents),
                      inv.payments.map((p) => centsToDollars(p.amountCents))
                    );
                    const isOverdue = new Date(inv.date) < overdueThreshold();
                    const overdueDays = isOverdue
                      ? Math.max(1, daysOverdue(new Date(inv.date), new Date(), business?.timezone))
                      : 0;
                    return (
                      <ListRow
                        key={inv.id}
                        title={inv.number}
                        subtitle={
                          isOverdue
                            ? `${inv.customer.name} · ${L('t10money.reminders.daysOverdue').replace('{days}', String(overdueDays))}`
                            : `${inv.customer.name} · ${L('t10money.money.balanceDue')}: ${formatMoney(remaining, business?.currency)}`
                        }
                        trailing={<MoneyText dollars={remaining} locale={locale} />}
                        href={`/invoices/${inv.id}`}
                        menuLabel={L('t10money.money.invoiceActions').replace('{number}', inv.number)}
                      />
                    );
                  })}
                </ul>
              </Card>
            )}
          </section>

          {/* 3. Awaiting a decision — sent quotes waiting on the customer. */}
          <section aria-labelledby="awaiting-decision">
            <SectionHeader
              title={`${L('t10money.money.quotesCardTitle')} (${openQuotes.length})`}
              action={
                openQuotes.length > 0 ? (
                  <span className="text-base font-bold tabular-nums text-ej-ink">
                    <MoneyText dollars={decisionTotal} locale={locale} />
                  </span>
                ) : undefined
              }
            />
            {openQuotes.length === 0 ? (
              <p className="text-sm text-ej-muted px-1">
                {L('t10money.money.noQuotesYet')}
              </p>
            ) : (
              <Card className="!p-0 overflow-hidden">
                <ul className="divide-y divide-ej-border">
                  {openQuotes.map((q) => {
                    const daysWaiting = Math.max(
                      0,
                      Math.floor((requestNowMs() - new Date(q.updatedAt).getTime()) / DAY_MS)
                    );
                    return (
                      <ListRow
                        key={q.id}
                        title={q.number}
                        subtitle={`${q.customer.name} · ${L('t10money.followups.daysWaiting').replace('{days}', String(daysWaiting))}`}
                        trailing={
                          <MoneyText dollars={centsToDollars(q.totalCents)} locale={locale} />
                        }
                        href={`/quotes/${q.id}`}
                        menuLabel={L('t10money.money.quoteActions').replace('{number}', q.number)}
                      />
                    );
                  })}
                </ul>
              </Card>
            )}
            {openQuotes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 px-1">
                <Link href="/quotes" className={secondaryBtnClass}>
                  {L('t10money.money.viewQuotes')}
                </Link>
                <Link href="/quotes/new" className={secondaryBtnClass}>
                  <Plus className="h-4 w-4" aria-hidden />
                  {L('t10money.money.newQuote')}
                </Link>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
