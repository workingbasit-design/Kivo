import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, Calendar, Clock, MapPin, User, Phone, Pencil,
  DollarSign, FileText, StickyNote, TrendingUp,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card, StatusBadge, SectionTitle } from '@/components/ui';
import { formatDateLabel, toISODateLocal, hasJobTime, localeDateTag, localeMoneyTag } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { entryMinutes, formatDuration } from '@/lib/timesheets';
import { sumLaborMinutes, summarizeJobCost } from '@/lib/costing';
import JobStatusButtons from '@/components/JobStatusButtons';
import { JobNoteForm, JobNoteItem } from '@/components/JobNoteForm';
import MilestoneInvoiceForm from '@/components/MilestoneInvoiceForm';
import { t } from '@/lib/i18n';
import { JobChecklist } from '@/components/JobChecklist';
import { JobExpenses } from '@/components/JobExpenses';
import { JobCostingCard } from '@/components/JobCostingCard';
import WhatsAppButton from '@/components/WhatsAppButton';
import SmsButton from '@/components/SmsButton';
import TechLocationSharer from '@/components/TechLocationSharer';
import OnMyWayNotifier from '@/components/OnMyWayNotifier';
import ReviewLinkButton from '@/components/ReviewLinkButton';
import ReviewRequestCard from '@/components/ReviewRequestCard';
import Attachments from '@/components/Attachments';
import { getReviewEligibility } from '@/lib/review-eligibility';
import { getLocale } from '@/lib/i18n/server';

function ProfitRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-graphite">{label}</dt>
      <dd
        className={`tabular-nums ${strong ? 'font-bold text-ink' : 'font-semibold text-ink'}`}
      >
        {value}
      </dd>
    </div>
  );
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const T = (k: string) => t(locale, `t10work.${k}`);
  const jobsL = (k: string) => t(locale, `jobs.${k}`);
  const dateLocale = localeDateTag(locale);
  const moneyLocale = localeMoneyTag(locale);
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true, name: true, regionCode: true, defaultHourlyRate: true } });
  const currency = business?.currency;

  const job = await prisma.job.findFirst({
    where: { id, businessId },
    include: {
      customer: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      jobNotes: {
        include: { author: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      },
      timeEntries: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { clockIn: 'desc' },
      },
      checklistItems: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      expenses: {
        orderBy: { spentAt: 'desc' },
      },
      invoices: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          number: true,
          total: true,
          status: true,
          milestoneLabel: true,
        },
      },
    },
  });
  if (!job) notFound();

  // Review-moat eligibility: show the review-link button only for completed
  // jobs with a paid invoice. Re-checked server-side at generation time.
  const reviewEligible = (await getReviewEligibility(businessId, job.id)).ok;

  const templates = await prisma.checklistTemplate.findMany({
    where: { businessId },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  // Labor minutes for costing exclude still-running sessions (null clockOut);
  // the entry list below still shows live elapsed time for transparency.
  const laborMinutes = sumLaborMinutes(job.timeEntries);
  const hourlyRate = business?.defaultHourlyRate ?? null;

  // Profitability — read-only P&L snapshot. Revenue is what has actually been
  // invoiced to date (quoted price shown as reference); costs are labor
  // (hours × business rate) plus expenses. Reuses the tested
  // summarizeJobCost math, which never divides by zero (marginPct is null
  // when revenue is 0). Only rendered when at least one input is non-zero.
  const invoicedToDate = job.invoices.reduce(
    (s, inv) => s + (Number.isFinite(inv.total) ? inv.total : 0),
    0
  );
  const plSummary = summarizeJobCost({
    price: invoicedToDate,
    laborMinutes,
    hourlyRate,
    expenses: job.expenses.map((e) => ({ category: e.category, amount: e.amount })),
  });
  const showProfitability =
    (job.price ?? 0) > 0 ||
    invoicedToDate > 0 ||
    laborMinutes > 0 ||
    plSummary.expensesTotal > 0;

  // job.date is a date-only DB value (midnight): format its calendar-day
  // key, never the Date instant, so the label can't shift a day when the
  // runtime timezone differs from the one that wrote the row.
  const jobDateKey = toISODateLocal(job.date);

  const infoRows: Array<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = [
    {
      icon: <Calendar size={14} className="text-zinc-400" />,
      label: jobsL('date'),
      value: formatDateLabel(jobDateKey, dateLocale),
    },
    {
      icon: <Clock size={14} className="text-zinc-400" />,
      label: jobsL('time'),
      value: hasJobTime(job.time) ? job.time : '—',
    },
    {
      icon: <DollarSign size={14} className="text-zinc-400" />,
      label: jobsL('price'),
      value: <span className="font-bold text-zinc-900 tabular-nums">{formatMoney(job.price, currency, moneyLocale)}</span>,
    },
    {
      icon: <User size={14} className="text-zinc-400" />,
      label: jobsL('customer'),
      value: (
        <Link
          href={`/customers/${job.customer.id}`}
          className="font-semibold text-ink hover:underline"
        >
          {job.customer.name}
        </Link>
      ),
    },
    ...(job.customer.phone
      ? [
          {
            icon: <Phone size={14} className="text-zinc-400" />,
            label: T('jobPhone'),
            value: (
              <a href={`tel:${job.customer.phone}`} className="hover:underline">
                {job.customer.phone}
              </a>
            ),
          },
        ]
      : []),
    {
      icon: <MapPin size={14} className="text-zinc-400" />,
      label: jobsL('address'),
      value: job.address || '—',
    },
    {
      icon: <User size={14} className="text-zinc-400" />,
      label: jobsL('technician'),
      value: job.technician || job.assignedTo?.name || T('jobUnassigned'),
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 min-h-[44px] px-2 -ml-2"
      >
        <ArrowLeft size={14} /> {T('jobBackToJobs')}
      </Link>

      <PageHeader
        title={job.title}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* wa.me chat with the customer — user taps to send from their own
                WhatsApp; EveryJob never sends anything automatically. */}
            <WhatsAppButton
              phone={job.customer.phone}
              regionCode={business?.regionCode}
              message={`Hi ${job.customer.name}! ${business?.name ?? 'We'} have your "${job.title}" booking scheduled for ${formatDateLabel(jobDateKey, dateLocale)}${hasJobTime(job.time) ? ` at ${job.time}` : ''}.`}
              label={T('jobWhatsAppLabel')}
            />
            {/* Free SMS: opens the phone's SMS app with the same message
                prefilled — sent from the user's own mobile plan, $0. */}
            <SmsButton
              phone={job.customer.phone}
              regionCode={business?.regionCode}
              message={`Hi ${job.customer.name}! ${business?.name ?? 'We'} have your "${job.title}" booking scheduled for ${formatDateLabel(jobDateKey, dateLocale)}${hasJobTime(job.time) ? ` at ${job.time}` : ''}.`}
              label={T('jobSmsLabel')}
            />
            {/* Review moat: a single-use review link is offered only when the
                job is complete AND the customer has a paid invoice. The
                eligibility is re-checked server-side when the link is
                generated and again at submission time. */}
            {reviewEligible && (
              <ReviewLinkButton
                jobId={job.id}
                idleLabel={T('jobRequestReview')}
                copiedLabel={T('jobReviewLinkCopied')}
                errorLabel={T('jobReviewLinkFailed')}
              />
            )}
            <Link
              href={`/jobs/${job.id}/edit`}
              className="bg-white hover:bg-zinc-50 text-zinc-700 min-h-[44px] px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 border border-zinc-200 shadow-sm"
            >
              <Pencil size={14} /> {t(locale, 'common.edit')}
            </Link>
          </div>
        }
      />

      {/* Status badge + controls — one client component so the badge updates
          instantly when the status changes (no stale server render). */}
      <Card className="p-5">
        <JobStatusButtons
          jobId={job.id}
          status={job.status}
          jobDate={jobDateKey}
          createdLabel={T('jobCreatedOn').replace('{date}', formatDateLabel(job.createdAt, dateLocale))}
          locale={locale}
        />
      </Card>

      {/* Live location sharing — per-job controls. Shown only while the job
          is scheduled or in progress; the server rejects pings for jobs in
          any other status. */}
      {(job.status === 'SCHEDULED' || job.status === 'IN PROGRESS') && (
        <>
          <Card className="p-5">
            <TechLocationSharer
              jobs={[
                {
                  id: job.id,
                  title: job.title,
                  customerName: job.customer.name,
                  address: job.customer.address ?? undefined,
                },
              ]}
            />
          </Card>

          {/* "On my way" customer notification — pre-written message with
              SMS/WhatsApp send buttons. Shown only while the job is active,
              matching the tracking-share endpoint's ACTIVE_STATUSES. The
              pro taps to send from their own apps; nothing is sent
              automatically. */}
          <Card className="p-5">
            <OnMyWayNotifier
              jobId={job.id}
              jobTitle={job.title}
              customerName={job.customer.name}
              phone={job.customer.phone}
              regionCode={business?.regionCode}
              businessName={business?.name ?? ''}
              techName={
                job.technician ||
                job.assignedTo?.name ||
                t(locale, 'jobops.notify.ourTech')
              }
              locale={locale}
            />
          </Card>
        </>
      )}

      {/* Post-job review request — COMPLETED jobs only. The single-use link
          is created via the server action, which re-checks the review moat
          (completed job + paid invoice) and never bypasses it. */}
      {job.status === 'COMPLETED' && (
        <ReviewRequestCard
          jobId={job.id}
          customerName={job.customer.name}
          businessName={business?.name ?? ''}
          phone={job.customer.phone}
          regionCode={business?.regionCode}
          locale={locale}
        />
      )}

      {/* Details */}
      <Card className="p-5 md:p-6">
        <SectionTitle>
          <span className="inline-flex items-center gap-2 normal-case tracking-normal">
            <FileText size={14} /> {T('jobDetailsTitle')}
          </span>
        </SectionTitle>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {infoRows.map((row) => (
            <div key={row.label} className="flex items-start gap-2.5">
              <span className="mt-0.5">{row.icon}</span>
              <div className="min-w-0">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  {row.label}
                </dt>
                <dd className="text-sm text-zinc-800 mt-0.5 break-words">{row.value}</dd>
              </div>
            </div>
          ))}
        </dl>
        {job.notes && (
          <div className="mt-5 pt-5 border-t border-zinc-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              {jobsL('notes')}
            </p>
            <p className="text-sm text-zinc-700 whitespace-pre-wrap">{job.notes}</p>
          </div>
        )}
      </Card>

      {/* Checklist (with progress bar) */}
      <JobChecklist
        jobId={job.id}
        locale={locale}
        items={job.checklistItems.map((i) => ({ id: i.id, label: i.label, done: i.done }))}
        templates={templates}
      />

      {/* Expenses */}
      <JobExpenses
        jobId={job.id}
        locale={locale}
        currency={currency}
        expenses={job.expenses.map((e) => ({
          id: e.id,
          description: e.description,
          amount: e.amount,
          category: e.category,
          spentAt: formatDateLabel(e.spentAt, dateLocale),
        }))}
      />

      {/* Job costing — quoted price vs labor + expenses */}
      <JobCostingCard
        jobId={job.id}
        locale={locale}
        currency={currency}
        price={job.price ?? 0}
        laborMinutes={laborMinutes}
        timeEntryCount={job.timeEntries.length}
        hourlyRate={hourlyRate}
        expenses={job.expenses.map((e) => ({ category: e.category, amount: e.amount }))}
        entries={job.timeEntries.slice(0, 8).map((e) => ({
          name: e.user.name || e.user.email,
          dateLabel: formatDateLabel(e.clockIn, dateLocale),
          active: !e.clockOut,
          minutes: entryMinutes(e.clockIn, e.clockOut),
        }))}
      />

      {/* Profitability — read-only P&L snapshot: what has actually been
          invoiced to date vs labor (hours × rate) and expenses. Purely
          derived from the job query above; no new data entry, no new
          models. Rendered only when at least one input is non-zero. */}
      {showProfitability && (
        <Card className="p-5 md:p-6">
          <SectionTitle>
            <span className="inline-flex items-center gap-2 normal-case tracking-normal">
              <TrendingUp size={14} /> {t(locale, 'jobops.profitability.title')}
            </span>
          </SectionTitle>
          <p className="text-xs text-zinc-500 -mt-3 mb-4">
            {t(locale, 'jobops.profitability.subtitle')}
          </p>
          <dl className="space-y-2.5 text-sm">
            <ProfitRow
              label={t(locale, 'jobops.profitability.quotedPrice')}
              value={formatMoney(job.price ?? 0, currency, moneyLocale)}
            />
            <ProfitRow
              label={t(locale, 'jobops.profitability.invoiced')}
              value={formatMoney(invoicedToDate, currency, moneyLocale)}
              strong
            />
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-graphite">{t(locale, 'jobops.profitability.labor')}</dt>
              <dd className="font-semibold text-ink tabular-nums text-right">
                {formatDuration(laborMinutes)}{' '}
                <span className="text-[11px] font-semibold text-graphite">
                  ×{' '}
                  {hourlyRate !== null
                    ? formatMoney(hourlyRate, currency, moneyLocale)
                    : '—'}
                  /h
                </span>{' '}
                {formatMoney(plSummary.laborCost, currency, moneyLocale)}
              </dd>
            </div>
            {plSummary.materialsCost > 0 && (
              <ProfitRow
                label={t(locale, 'jobops.profitability.materials')}
                value={formatMoney(plSummary.materialsCost, currency, moneyLocale)}
              />
            )}
            {plSummary.travelCost > 0 && (
              <ProfitRow
                label={t(locale, 'jobops.profitability.travel')}
                value={formatMoney(plSummary.travelCost, currency, moneyLocale)}
              />
            )}
            {plSummary.otherCost > 0 && (
              <ProfitRow
                label={t(locale, 'jobops.profitability.other')}
                value={formatMoney(plSummary.otherCost, currency, moneyLocale)}
              />
            )}

            <div className="border-t border-smoke pt-2.5" />

            <ProfitRow
              label={t(locale, 'jobops.profitability.totalCost')}
              value={formatMoney(plSummary.totalCost, currency, moneyLocale)}
              strong
            />
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-graphite">{t(locale, 'jobops.profitability.profit')}</dt>
              <dd
                className={`font-bold tabular-nums ${
                  plSummary.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatMoney(plSummary.profit, currency, moneyLocale)}
                <span className="text-[11px] font-semibold ml-2">
                  {plSummary.marginPct !== null
                    ? `${plSummary.marginPct.toFixed(1)}% ${t(
                        locale,
                        'jobops.profitability.margin'
                      ).toLowerCase()}`
                    : '—'}
                </span>
              </dd>
            </div>
          </dl>
        </Card>
      )}

      {/* Job photos & files — the deferred job-photo decision resolves to
          universal Attachments (Vercel Blob, Track 6A). */}
      <Attachments entityType="job" entityId={job.id} locale={locale} />

      {/* Progress invoicing — milestone invoices linked to this job */}
      <Card className="p-5 md:p-6">
        <SectionTitle>
          <span className="inline-flex items-center gap-2 normal-case tracking-normal">
            <DollarSign size={14} /> {t(locale, 'billing.progressTitle')}
          </span>
        </SectionTitle>
        <p className="text-xs text-zinc-500 mb-4">
          {t(locale, 'billing.progressDesc')}
        </p>
        {job.invoices.length > 0 ? (
          <ul className="divide-y divide-zinc-100 mb-2">
            {job.invoices.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 hover:bg-zinc-50 rounded-lg px-2 -mx-2 min-h-[56px]"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 shrink-0">
                      {t(locale, 'billing.milestoneBadge')}
                    </span>
                    <span className="text-sm font-semibold text-zinc-900 truncate">
                      {inv.milestoneLabel || inv.number}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-zinc-900 tabular-nums">
                      {formatMoney(inv.total, currency, moneyLocale)}
                    </span>
                    <StatusBadge status={inv.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-zinc-400 py-2">
            {t(locale, 'billing.noProgressInvoices')}
          </p>
        )}
        <MilestoneInvoiceForm jobId={job.id} locale={locale} />
      </Card>

      {/* Job notes */}
      <Card className="p-5 md:p-6">
        <SectionTitle
          action={
            <span className="text-[11px] font-semibold text-zinc-400 tabular-nums">
              ({job.jobNotes.length})
            </span>
          }
        >
          <span className="inline-flex items-center gap-2 normal-case tracking-normal">
            <StickyNote size={14} /> {T('jobNotesTitle')}
          </span>
        </SectionTitle>
        {job.jobNotes.length === 0 ? (
          <p className="text-xs text-zinc-400 py-3">
            {T('jobNotesEmpty')}
          </p>
        ) : (
          <div className="mb-2">
            {job.jobNotes.map((note) => (
              <JobNoteItem
                key={note.id}
                jobId={job.id}
                locale={locale}
                noteId={note.id}
                content={note.content}
                authorName={note.author.name || note.author.email}
                createdAt={formatDateLabel(note.createdAt, dateLocale)}
              />
            ))}
          </div>
        )}
        <div className="pt-4 border-t border-zinc-100 mt-2">
          <JobNoteForm jobId={job.id} locale={locale} />
        </div>
      </Card>
    </div>
  );
}
