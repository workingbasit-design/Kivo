import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, Calendar, Clock, MapPin, User, Phone, Pencil,
  DollarSign, FileText, StickyNote, Timer,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card, StatusBadge } from '@/components/ui';
import { formatDateLabel, toISODateLocal, hasJobTime } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { entryMinutes, formatDuration } from '@/lib/timesheets';
import JobStatusButtons from '@/components/JobStatusButtons';
import { JobNoteForm, JobNoteItem } from '@/components/JobNoteForm';
import WhatsAppButton from '@/components/WhatsAppButton';

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { businessId } = await requireAuth();
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true, name: true, regionCode: true } });
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
    },
  });
  if (!job) notFound();

  const laborMinutes = job.timeEntries.reduce(
    (s, e) => s + entryMinutes(e.clockIn, e.clockOut),
    0
  );

  // job.date is a date-only DB value (midnight): format its calendar-day
  // key, never the Date instant, so the label can't shift a day when the
  // runtime timezone differs from the one that wrote the row.
  const jobDateKey = toISODateLocal(job.date);

  const infoRows: Array<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = [
    {
      icon: <Calendar size={14} className="text-zinc-400" />,
      label: 'Date',
      value: formatDateLabel(jobDateKey),
    },
    {
      icon: <Clock size={14} className="text-zinc-400" />,
      label: 'Time',
      value: hasJobTime(job.time) ? job.time : '—',
    },
    {
      icon: <DollarSign size={14} className="text-zinc-400" />,
      label: 'Price',
      value: <span className="font-bold text-zinc-900">{formatMoney(job.price, currency)}</span>,
    },
    {
      icon: <User size={14} className="text-zinc-400" />,
      label: 'Customer',
      value: (
        <Link
          href={`/customers/${job.customer.id}`}
          className="font-semibold text-[#6329d4] hover:underline"
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
              message={`Hi ${job.customer.name}! ${business?.name ?? 'We'} have your "${job.title}" booking scheduled for ${formatDateLabel(jobDateKey)}${hasJobTime(job.time) ? ` at ${job.time}` : ''}.`}
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
          Created {formatDateLabel(job.createdAt)}
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

      {/* Job costing — labor hours */}
      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-4 flex items-center gap-2">
          <Timer size={14} /> Job costing
          <span className="text-[11px] font-semibold text-zinc-400">
            ({job.timeEntries.length} {job.timeEntries.length === 1 ? 'entry' : 'entries'})
          </span>
        </h2>
        <div className="flex items-baseline gap-2 mb-3">
          <p className="text-2xl font-bold text-zinc-900 tracking-tight tabular-nums">
            {formatDuration(laborMinutes)}
          </p>
          <p className="text-xs text-zinc-500">total labor logged</p>
        </div>
        {job.timeEntries.length === 0 ? (
          <p className="text-xs text-zinc-400">
            No time logged yet. Clock in from the Timesheets page and pick this job.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
            {job.timeEntries.slice(0, 8).map((e) => (
              <li key={e.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-800 truncate">
                    {e.user.name || e.user.email}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {formatDateLabel(e.clockIn)}
                    {!e.clockOut && ' · active now'}
                  </p>
                </div>
                <span className="text-sm font-bold text-zinc-900 tabular-nums shrink-0">
                  {formatDuration(entryMinutes(e.clockIn, e.clockOut))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

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
                createdAt={formatDateLabel(note.createdAt)}
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
