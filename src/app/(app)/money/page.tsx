import { Plus, FileText, Clock, Hourglass, Wallet } from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { Card, EmptyState, Button, ListRow } from '@/components/kit';


import { formatMoney, centsToDollars } from '@/lib/money';
import { daysOverdue, remainingBalance, OVERDUE_AFTER_DAYS, DAY_MS } from '@/lib/revenue';
import { formatDisplayDate } from '@/lib/attention';
import { kitButtonClass , PageHeader} from '@/components/kit';

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
        summary={L('t10money.money.subtitle')}
        actionLabel={L('t10money.money.newInvoice')}
        actionHref="/invoices/new"
        actionIcon={<Plus />}
      />

      {allCaughtUp ? (
        <Card>
          <EmptyState
            icon={<Wallet />}
            title={L('t10money.money.emptyTitle')}
            text={L('t10money.money.emptyDesc')}
          />
          <div className="flex justify-center pb-10 -mt-6">
            <Button href="/invoices/new" variant="primary">
              <Plus className="h-4 w-4" aria-hidden />
              {L('t10money.money.newInvoice')}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* 1. Ready to invoice — completed jobs with no invoice yet. */}
          <section aria-labelledby="ready-to-invoice">
<div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">`${L('t10money.money.unbilledTitle')} (${unbilledJobs.length})`</h3>
              {unbilledJobs.length > 0 ? (
                <span className="num text-[20px] font-bold tabular-nums text-ink">
                  {formatMoney(readyTotal, 'CAD', locale)}
                </span>
              ) : null}
            </div>
            {unbilledJobs.length === 0 ? (
              <p className="text-sm text-ink-2 px-1">
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
                      amount={
                        j.noCharge
                          ? '$0'
                          : formatMoney(
                              j.priceCents != null ? centsToDollars(j.priceCents) : 0,
                              'CAD',
                              locale
                            )
                      }
                      amountCaption={j.noCharge ? L('t10money.money.noCharge') : undefined}
                      href={`/jobs/${j.id}`}
                    />
                  ))}
                </ul>
              </Card>
            )}
            {unbilledJobs.length > 0 && (
              <p className="mt-2 text-xs text-ink-2 px-1">{L('t10money.money.unbilledDesc')}</p>
            )}
          </section>

          {/* 2. Awaiting payment — unpaid invoices, oldest first. */}
          <section aria-labelledby="awaiting-payment">
<div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">`${L('t10money.money.invoicesCardTitle')} (${unpaidInvoices.length})`</h3>
              {unpaidInvoices.length > 0 ? (
                <span className="num text-[20px] font-bold tabular-nums text-ink">
                  {formatMoney(awaitingTotal, 'CAD', locale)}
                </span>
              ) : null}
            </div>
            {unpaidInvoices.length === 0 ? (
              <p className="text-sm text-ink-2 px-1">
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
                        amount={formatMoney(remaining, 'CAD', locale)}
                        href={`/invoices/${inv.id}`}
                      />
                    );
                  })}
                </ul>
              </Card>
            )}
          </section>

          {/* 3. Awaiting a decision — sent quotes waiting on the customer. */}
          <section aria-labelledby="awaiting-decision">
<div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">`${L('t10money.money.quotesCardTitle')} (${openQuotes.length})`</h3>
              {openQuotes.length > 0 ? (
                <span className="num text-[20px] font-bold tabular-nums text-ink">
                  {formatMoney(decisionTotal, 'CAD', locale)}
                </span>
              ) : null}
            </div>
            {openQuotes.length === 0 ? (
              <p className="text-sm text-ink-2 px-1">
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
                        amount={formatMoney(centsToDollars(q.totalCents), 'CAD', locale)}
                        href={`/quotes/${q.id}`}
                      />
                    );
                  })}
                </ul>
              </Card>
            )}
            {openQuotes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 px-1">
                <Button href="/quotes" variant="secondary">
                  {L('t10money.money.viewQuotes')}
                </Button>
                <Button href="/quotes/new" variant="secondary">
                  <Plus className="h-4 w-4" aria-hidden />
                  {L('t10money.money.newQuote')}
                </Button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
