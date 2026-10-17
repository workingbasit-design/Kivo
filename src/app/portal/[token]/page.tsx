import { headers } from 'next/headers';
import Logo from '@/components/Logo';
import { Briefcase, FileText, Phone, ReceiptText, Wallet } from '@/components/icons';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { resolveCustomerPortalToken } from '@/lib/portal';
import { Card, StatusBadge } from '@/components/ui';
import { formatCents } from '@/lib/money';
import { formatDateShort, formatJobTime, jobDisplayStatus } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import PortalNotice from '@/components/PortalNotice';
import { clientIpFromHeaders } from '@/lib/client-ip';

/**
 * Public customer portal. No authentication - the magic-link token in the
 * URL is the only capability. The page loads exactly one customer and
 * their own jobs/quotes/invoices, always scoped to the token's
 * (businessId, customerId). Nothing else from any business is reachable.
 */

const PORTAL_LIMIT = { limit: 30, windowMs: 60 * 1000 };

async function clientIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

export default async function CustomerPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const rl = rateLimit(`portal:customer:${await clientIp()}`, PORTAL_LIMIT);
  if (!rl.ok) return <PortalNotice variant="rate-limited" />;

  const resolved = await resolveCustomerPortalToken(token);
  if (!resolved) return <PortalNotice variant="expired" />;

  const { businessId, customerId } = resolved;

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    select: {
      id: true,
      name: true,
      phone: true,
      business: {
        select: { name: true, phone: true, currency: true, regionCode: true },
      },
    },
  });
  if (!customer) return <PortalNotice variant="expired" />;

  const [jobs, quotes, invoices] = await Promise.all([
    prisma.job.findMany({
      where: { customerId, businessId },
      select: { id: true, title: true, date: true, time: true, priceCents: true, status: true },
      orderBy: { date: 'desc' },
      take: 10,
    }),
    prisma.quote.findMany({
      where: { customerId, businessId },
      select: { id: true, number: true, title: true, totalCents: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.invoice.findMany({
      where: { customerId, businessId },
      select: {
        id: true,
        number: true,
        date: true,
        totalCents: true,
        status: true,
        payments: { select: { amountCents: true } },
      },
      orderBy: { date: 'desc' },
      take: 10,
    }),
  ]);

  const currency = customer.business.currency;
  const balances = invoices.map((inv) => {
    const paid = inv.payments.reduce((s, p) => s + p.amountCents, BigInt(0));
    const balance = inv.totalCents > paid ? inv.totalCents - paid : BigInt(0);
    return { ...inv, balance };
  });
  const totalOwed = balances.reduce((s, i) => s + i.balance, BigInt(0));

  const locale = await getLocale();
  const L = (path: string) => t(locale, path);
  const moneyLocale = locale === 'fr' ? 'fr' : 'en';
  const dateLocale = locale === 'fr' ? 'fr-CA' : 'en-CA';

  return (
    <div className="min-h-screen bg-paper font-sans">
      <header className="bg-asphalt text-white">
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="mb-4">
            <Logo tone="onDark" size={28} />
          </div>
          <p className="text-[11px] font-semibold text-white/60 mb-1">
            {customer.business.name}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{L('portal.hiName').replace('{name}', customer.name)}</h1>
          <p className="text-white/60 mt-1 text-sm">
            {L('portal.tagline')}
          </p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-12">
        {totalOwed > BigInt(0) && (
          <Card className="p-5 bg-warn-bg/60 border-amber-200">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink flex items-center gap-2">
                <Wallet size={15} className="text-warn-text" /> {L('portal.balanceDue')}
              </p>
              <p className="text-xl font-bold text-ink">{formatCents(totalOwed, currency, moneyLocale)}</p>
            </div>
            {customer.business.phone && (
              <p className="text-xs text-ink-2 mt-2 flex items-center gap-1.5">
                <Phone size={12} /> {L('portal.questionsCall').replace('{business}', customer.business.name).replace('{phone}', customer.business.phone)}
              </p>
            )}
          </Card>
        )}

        <section>
          <h2 className="text-sm font-bold text-ink mb-2 flex items-center gap-2">
            <Briefcase size={14} className="text-ink-2" /> {L('portal.jobs')}
          </h2>
          <Card>
            {jobs.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-2 text-center">{L('portal.noJobs')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {jobs.map((j) => (
                  <li key={j.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-ink flex-1 min-w-0">{j.title}</p>
                      <span className="text-sm font-bold text-ink shrink-0">
                        {formatCents(j.priceCents, currency, moneyLocale)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-1.5">
                      <p className="text-xs text-ink-2">
                        {formatDateShort(j.date, dateLocale)}{j.time ? ` · ${formatJobTime(j.time, locale)}` : ''}
                      </p>
                      <StatusBadge status={jobDisplayStatus(j.status, j.date)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section>
          <h2 className="text-sm font-bold text-ink mb-2 flex items-center gap-2">
            <FileText size={14} className="text-ink-2" /> {L('portal.quotes')}
          </h2>
          <Card>
            {quotes.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-2 text-center">{L('portal.noQuotes')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {quotes.map((q) => (
                  <li key={q.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-ink flex-1 min-w-0">{q.title}</p>
                      <span className="text-sm font-bold text-ink shrink-0">
                        {formatCents(q.totalCents, currency, moneyLocale)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-1.5">
                      <p className="text-xs text-ink-2">{q.number}</p>
                      <StatusBadge status={q.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section>
          <h2 className="text-sm font-bold text-ink mb-2 flex items-center gap-2">
            <ReceiptText size={14} className="text-ink-2" /> {L('portal.invoices')}
          </h2>
          <Card>
            {balances.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-2 text-center">{L('portal.noInvoices')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {balances.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink">{inv.number}</p>
                      <p className="text-xs text-ink-2">{formatDateShort(inv.date, dateLocale)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-ink">{formatCents(inv.totalCents, currency, moneyLocale)}</p>
                      {inv.balance > BigInt(0) ? (
                        <p className="text-[11px] font-semibold text-warn-text">
                          {L('portal.dueAmount').replace('{amount}', formatCents(inv.balance, currency, moneyLocale))}
                        </p>
                      ) : (
                        <p className="text-[11px] font-semibold text-ok">{L('portal.paid')}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <p className="text-center text-[11px] text-ink-2 pt-2">
          {L('portal.poweredBy').replace('{business}', customer.business.name)}
        </p>
      </main>
    </div>
  );
}
