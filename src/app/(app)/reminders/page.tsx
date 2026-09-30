import React from 'react';
import { BellRing, CalendarClock, FileText, PhoneMissed } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { PageHeader, Card, EmptyState, StatusBadge } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { formatWhenLabel } from '@/lib/reminders';
import { todayInTimezone } from '@/lib/utils';
import ReminderRow, { type ReminderUiStrings } from '@/components/reminders/ReminderRow';
import MissedCallCard from '@/components/reminders/MissedCallCard';

/**
 * Reminder queue: one-tap draft queue for upcoming jobs + invoice
 * follow-ups + a manual missed-call text-back quick action.
 *
 * EveryJob never sends anything — every draft is text the owner sends
 * themselves via WhatsApp / SMS / email / copy.
 */
export default async function RemindersPage() {
  const { businessId } = await requireAuth();
  const locale: Locale = await getLocale();

  const ui: ReminderUiStrings = {
    prepareReminder: t(locale, 'reminders.prepareReminder'),
    preparing: t(locale, 'reminders.preparing'),
    redraft: t(locale, 'reminders.redraft'),
    draftReady: t(locale, 'reminders.draftReady'),
    neverSendsNote: t(locale, 'reminders.neverSendsNote'),
    whatsapp: t(locale, 'reminders.whatsapp'),
    sms: t(locale, 'reminders.sms'),
    email: t(locale, 'reminders.email'),
    copy: t(locale, 'reminders.copy'),
  };

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { regionCode: true, currency: true, timezone: true },
  });
  const regionCode = business?.regionCode ?? 'CA';
  const currency = business?.currency ?? 'CAD';

  // Job dates are stored at (server-local) midnight of their calendar day,
  // so the window must start at the business-local day boundary — comparing
  // against the current instant would hide today's jobs after midnight.
  const todayStr = todayInTimezone(business?.timezone, regionCode);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const dayStart = new Date(ty, tm - 1, td, 0, 0, 0, 0);
  const in48h = new Date(dayStart.getTime() + 48 * 60 * 60 * 1000);

  const [jobRows, invoiceRows, customerRows] = await Promise.all([
    // Upcoming jobs (next 48h from the start of the business-local day,
    // scheduled/in-progress) whose customer has a phone.
    prisma.job.findMany({
      where: {
        businessId,
        date: { gte: dayStart, lte: in48h },
        status: { in: ['SCHEDULED', 'IN PROGRESS'] },
      },
      include: {
        customer: { select: { name: true, phone: true, email: true } },
      },
      orderBy: { date: 'asc' },
      take: 50,
    }),
    // Unpaid / partially paid invoices, oldest first.
    prisma.invoice.findMany({
      where: { businessId, status: { in: ['UNPAID', 'PARTIALLY PAID'] } },
      include: {
        customer: { select: { name: true, phone: true, email: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { date: 'asc' },
      take: 50,
    }),
    // Customers with phone numbers, for the manual missed-call quick-draft.
    prisma.customer.findMany({
      where: { businessId, phone: { not: null } },
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ]);

  const jobs = jobRows.filter(
    (j) => j.customer.phone && j.customer.phone.trim().length > 0
  );

  const invoices = invoiceRows
    .map((inv) => {
      const paid = Math.round(inv.payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
      const remaining = Math.round((inv.total - paid) * 100) / 100;
      return { ...inv, remaining };
    })
    .filter((inv) => inv.remaining > 0);

  const textableCustomers = customerRows.filter(
    (c) => c.phone && c.phone.trim().length > 0
  ) as { id: string; name: string; phone: string }[];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, 'reminders.title')}
        subtitle={t(locale, 'reminders.subtitle')}
      />

      {/* Upcoming jobs */}
      <section aria-label={t(locale, 'reminders.upcomingJobs')}>
        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-xl bg-ink text-lime flex items-center justify-center shrink-0">
              <CalendarClock size={16} />
            </span>
            <h2 className="text-sm font-bold text-zinc-900">
              {t(locale, 'reminders.upcomingJobs')}
            </h2>
          </div>

          {jobs.length === 0 ? (
            <EmptyState
              icon={<BellRing size={24} />}
              title={t(locale, 'reminders.upcomingJobs')}
              description={t(locale, 'reminders.upcomingJobsEmpty')}
            />
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <ReminderRow
                  key={job.id}
                  kind="job"
                  recordId={job.id}
                  phone={job.customer.phone}
                  email={job.customer.email}
                  emailSubject={t(locale, 'reminders.emailSubjectJob')}
                  regionCode={regionCode}
                  ui={ui}
                >
                  <p className="text-sm font-bold text-zinc-900 truncate">
                    {job.customer.name}
                  </p>
                  <p className="text-xs text-graphite truncate">{job.title}</p>
                  <p className="text-xs text-graphite mt-0.5">
                    {formatWhenLabel(job.date, job.time, locale)}
                  </p>
                </ReminderRow>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* Invoice follow-ups */}
      <section aria-label={t(locale, 'reminders.invoiceFollowups')}>
        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <FileText size={16} />
            </span>
            <h2 className="text-sm font-bold text-zinc-900">
              {t(locale, 'reminders.invoiceFollowups')}
            </h2>
          </div>

          {invoices.length === 0 ? (
            <EmptyState
              icon={<FileText size={24} />}
              title={t(locale, 'reminders.invoiceFollowups')}
              description={t(locale, 'reminders.invoiceFollowupsEmpty')}
            />
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => (
                <ReminderRow
                  key={inv.id}
                  kind="invoice"
                  recordId={inv.id}
                  phone={inv.customer.phone}
                  email={inv.customer.email}
                  emailSubject={`${t(locale, 'reminders.emailSubjectInvoice')} ${inv.number}`}
                  regionCode={regionCode}
                  ui={ui}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-zinc-900 truncate">
                      {inv.customer.name}
                    </p>
                    <StatusBadge status={inv.status} />
                  </div>
                  <p className="text-xs text-graphite">
                    {inv.number} · {formatMoney(inv.remaining, currency, locale)}
                  </p>
                </ReminderRow>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* Missed-call text-back (manual quick-draft) */}
      <section aria-label={t(locale, 'reminders.missedCall')}>
        <MissedCallCard
          customers={textableCustomers}
          regionCode={regionCode}
          ui={ui}
          title={t(locale, 'reminders.missedCall')}
          note={t(locale, 'reminders.missedCallNote')}
          pickCustomerLabel={t(locale, 'reminders.pickCustomer')}
          draftLabel={t(locale, 'reminders.draftTextback')}
        />
      </section>

      <p className="flex items-center gap-2 text-[11px] text-graphite">
        <PhoneMissed size={12} />
        {t(locale, 'reminders.neverSendsNote')}
      </p>
    </div>
  );
}
