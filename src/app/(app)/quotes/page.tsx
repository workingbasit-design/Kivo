import Link from 'next/link';
import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import { Plus, ClipboardList, Clock } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { fillTemplate, daysWaiting, FOLLOWUP_AFTER_DAYS, DAY_MS } from '@/lib/revenue';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, StatusBadge, EmptyState, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import { formatDateShort, cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { QUOTE_STATUSES } from '@/lib/validations';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { getActiveShareToken } from '@/lib/share';
import SmsButton from '@/components/SmsButton';
import WhatsAppButton from '@/components/WhatsAppButton';
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

  const [business, quotes, staleQuotes] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { currency: true, name: true, regionCode: true },
    }),
    prisma.quote.findMany({
      where: {
        businessId,
        ...(activeFilter !== 'ALL' ? { status: activeFilter } : {}),
      },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    // Follow-up queue: SENT quotes waiting >3 days, longest-waiting first.
    prisma.quote.findMany({
      where: {
        businessId,
        status: 'SENT',
        updatedAt: { lt: new Date(Date.now() - FOLLOWUP_AFTER_DAYS * DAY_MS) },
      },
      select: {
        id: true,
        number: true,
        total: true,
        updatedAt: true,
        customer: { select: { name: true, phone: true } },
      },
      orderBy: { updatedAt: 'asc' },
      take: 5,
    }),
  ]);

  const pipelineTotal = quotes
    .filter((q) => q.status === 'SENT' || q.status === 'APPROVED')
    .reduce((s, q) => s + q.total, 0);

  // Resolve each follow-up quote's public review-and-approve link (/q/[token])
  // when a usable share token exists; otherwise fall back to the detail page.
  const followupLinks = await Promise.all(
    staleQuotes.map(async (q) => {
      const rec = await getActiveShareToken(businessId, 'QUOTE', { quoteId: q.id });
      return { id: q.id, link: rec ? `/q/${rec.token}` : `/quotes/${q.id}` };
    }),
  );
  const linkFor = (id: string) =>
    followupLinks.find((l) => l.id === id)?.link ?? `/quotes/${id}`;

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
  const quoteWord =
    quotes.length === 1
      ? t(locale, 'quotes.list.quoteOne')
      : t(locale, 'quotes.list.quoteOther');
  const subtitle = t(locale, 'quotes.list.subtitle')
    .replace('{count}', String(quotes.length))
    .replace('{quoteWord}', quoteWord)
    .replace('{pipeline}', formatMoney(pipelineTotal, business?.currency));

  const FILTER_LABELS: Record<(typeof FILTERS)[number], string> = {
    ALL: t(locale, 'quotes.list.filterAll'),
    DRAFT: t(locale, 'quotes.list.filterDraft'),
    SENT: t(locale, 'quotes.list.filterSent'),
    APPROVED: t(locale, 'quotes.list.filterApproved'),
    DECLINED: t(locale, 'quotes.list.filterDeclined'),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, 'quotes.list.title')}
        subtitle={subtitle}
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
              <Plus size={14} /> {t(locale, 'quotes.list.newQuote')}
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
            {FILTER_LABELS[f]}
          </Link>
        ))}
      </div>

      {/* Quote follow-up queue — revenue recovery. Only the user sends
          anything: buttons open their own SMS/WhatsApp apps prefilled. */}
      {staleQuotes.length > 0 && activeFilter === 'ALL' && (
        <Card className="!p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                <Clock className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 className="font-semibold">
                  {t(locale, 't10money.followups.title')}{' '}
                  <span className="text-sm font-bold text-violet-700">({staleQuotes.length})</span>
                </h2>
                <p className="text-xs text-zinc-500">{t(locale, 't10money.followups.desc')}</p>
              </div>
            </div>
          </div>
          <ul className="divide-y divide-zinc-100">
            {staleQuotes.map((q) => {
              const waitingDays = Math.max(1, daysWaiting(new Date(q.updatedAt)));
              const message = fillTemplate(t(locale, 't10money.followups.message'), {
                customerName: q.customer.name,
                businessName: business?.name ?? '',
                number: q.number,
                amount: formatMoney(q.total, business?.currency),
                signLink: linkFor(q.id),
              });
              return (
                <li key={q.id} className="px-4 sm:px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        <Link href={`/quotes/${q.id}`} className="hover:underline">
                          {q.number}
                        </Link>
                        <span className="font-normal text-zinc-500"> · {q.customer.name}</span>
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        <span className="font-semibold text-violet-700">
                          {t(locale, 't10money.followups.daysWaiting').replace(
                            '{days}',
                            String(waitingDays),
                          )}
                        </span>
                        {' · '}
                        {formatMoney(q.total, business?.currency)}
                      </p>
                    </div>
                  </div>
                  <details className="mt-2 group">
                    <summary className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-sky-700 hover:underline min-h-[32px]">
                      {t(locale, 't10money.followups.sendFollowup')}
                    </summary>
                    <div className="mt-2 rounded-xl bg-zinc-50 border border-zinc-200 p-3 space-y-3">
                      <p className="text-xs text-zinc-700 whitespace-pre-wrap">{message}</p>
                      {q.customer.phone ? (
                        <div className="flex flex-wrap gap-2">
                          <SmsButton
                            phone={q.customer.phone}
                            regionCode={business?.regionCode}
                            message={message}
                            label={t(locale, 't10money.reminders.smsLabel')}
                          />
                          <WhatsAppButton
                            phone={q.customer.phone}
                            regionCode={business?.regionCode}
                            message={message}
                            label={t(locale, 't10money.reminders.waLabel')}
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500">
                          {t(locale, 't10money.reminders.noPhone')}
                        </p>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
          <div className="px-5 py-3 border-t border-zinc-100">
            <Link href="/quotes?status=SENT" className={secondaryBtnClass}>
              {t(locale, 't10money.followups.viewAll')}
            </Link>
          </div>
        </Card>
      )}

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
