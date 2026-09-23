import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, Calendar, Clock, MapPin, User, Phone, Pencil,
  DollarSign, FileText, StickyNote,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card, StatusBadge } from '@/components/ui';
import { formatDateLabel, toISODateLocal, hasJobTime, localeDateTag, localeMoneyTag } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { entryMinutes } from '@/lib/timesheets';
import { sumLaborMinutes } from '@/lib/costing';
import JobStatusButtons from '@/components/JobStatusButtons';
import { JobNoteForm, JobNoteItem } from '@/components/JobNoteForm';
import { JobChecklist } from '@/components/JobChecklist';
import { JobExpenses } from '@/components/JobExpenses';
import { JobCostingCard } from '@/components/JobCostingCard';
import WhatsAppButton from '@/components/WhatsAppButton';
import { getLocale } from '@/lib/i18n/server';

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { businessId } = await requireAuth();
  const locale = await getLocale();
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
    },
  });
  if (!job) notFound();

  const templates = await prisma.checklistTemplate.findMany({
    where: { businessId },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  // Labor minutes for costing exclude still-running sessions (null clockOut);
  // the entry list below still shows live elapsed time for transparency.
  const laborMinutes = sumLaborMinutes(job.timeEntries);

  // job.date is a date-only DB value (midnight): format its calendar-day
  // key, never the Date instant, so the label can't shift a day when the
  // runtime timezone differs from the one that wrote the row.
  const jobDateKey = toISODateLocal(job.date);

  const infoRows: Array<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = [
    {
      icon: <Calendar size={14} className="text-zinc-400" />,
      label: 'Date',
      value: formatDateLabel(jobDateKey, dateLocale),
    },
    {
      icon: <Clock size={14} className="text-zinc-400" />,
      label: 'Time',
      value: hasJobTime(job.time) ? job.time : '—',
    },
    {
      icon: <DollarSign size={14} className="text-zinc-400" />,
      label: 'Price',
      value: <span className="font-bold text-zinc-900">{formatMoney(job.price, currency, moneyLocale)}</span>,
    },
    {
      icon: <User size={14} className="text-zinc-400" />,
      label: 'Customer',
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
            label: 'Phone',
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
      label: 'Address',
      value: job.address || '—',
    },
    {
      icon: <User size={14} className="text-zinc-400" />,
      label: 'Technician',
      value: job.technician || job.assignedTo?.name || 'Unassigned',
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft size={14} /> Back to jobs
      </Link>

      <PageHeader
        title={job.title}
        actions={
          <div className="flex items-center gap-2">
            {/* wa.me chat with the customer — user taps to send from their own
                WhatsApp; EveryJob never sends anything automatically. */}
            <WhatsAppButton
              phone={job.customer.phone}
              regionCode={business?.regionCode}
              message={`Hi ${job.customer.name}! ${business?.name ?? 'We'} have your "${job.title}" booking scheduled for ${formatDateLabel(jobDateKey, dateLocale)}${hasJobTime(job.time) ? ` at ${job.time}` : ''}.`}
              label="WhatsApp"
            />
            <Link
              href={`/jobs/${job.id}/edit`}
              className="bg-white hover:bg-zinc-50 text-zinc-700 px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 border border-zinc-200 shadow-sm"
            >
              <Pencil size={14} /> Edit
            </Link>
          </div>
        }
      />

      <div className="flex items-center gap-3">
        <StatusBadge status={job.status} />
        <span className="text-xs text-zinc-400">
          Created {formatDateLabel(job.createdAt, dateLocale)}
        </span>
      </div>

      {/* Status controls */}
      <Card className="p-5">
        <JobStatusButtons jobId={job.id} status={job.status} />
      </Card>

      {/* Details */}
      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-4 flex items-center gap-2">
          <FileText size={14} /> Job details
        </h2>
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
              Notes
            </p>
            <p className="text-sm text-zinc-700 whitespace-pre-wrap">{job.notes}</p>
          </div>
        )}
      </Card>

      {/* Checklist */}
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
        hourlyRate={business?.defaultHourlyRate ?? null}
        expenses={job.expenses.map((e) => ({ category: e.category, amount: e.amount }))}
        entries={job.timeEntries.slice(0, 8).map((e) => ({
          name: e.user.name || e.user.email,
          dateLabel: formatDateLabel(e.clockIn, dateLocale),
          active: !e.clockOut,
          minutes: entryMinutes(e.clockIn, e.clockOut),
        }))}
      />

      {/* Job notes */}
      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-2 flex items-center gap-2">
          <StickyNote size={14} /> Activity notes
          <span className="text-[11px] font-semibold text-zinc-400">
            ({job.jobNotes.length})
          </span>
        </h2>
        {job.jobNotes.length === 0 ? (
          <p className="text-xs text-zinc-400 py-3">
            No notes yet. Add visit updates, customer requests, or follow-ups here.
          </p>
        ) : (
          <div className="mb-2">
            {job.jobNotes.map((note) => (
              <JobNoteItem
                key={note.id}
                jobId={job.id}
                noteId={note.id}
                content={note.content}
                authorName={note.author.name || note.author.email}
                createdAt={formatDateLabel(note.createdAt, dateLocale)}
              />
            ))}
          </div>
        )}
        <div className="pt-4 border-t border-zinc-100 mt-2">
          <JobNoteForm jobId={job.id} />
        </div>
      </Card>
    </div>
  );
}
