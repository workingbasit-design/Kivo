import React from 'react';
import Link from 'next/link';
import { Clock3, Filter, Timer } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import ClockWidget from '@/components/ClockWidget';
import ManualEntryForm from '@/components/ManualEntryForm';
import DeleteEntryButton from '@/components/DeleteEntryButton';
import {
  entryMinutes,
  formatDuration,
  parseDateStart,
  parseDateEnd,
  toDateInputValue,
  startOfDayDaysAgo,
} from '@/lib/timesheets';
import { formatDateLabel } from '@/lib/utils';

function formatClockTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString('en-CA', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; from?: string; to?: string }>;
}) {
  const { businessId, user } = await requireAuth();
  const sp = await searchParams;
  const isAdmin = user.role === 'ADMIN';

  // Active session for the clock widget (self only).
  const activeEntry = await prisma.timeEntry.findFirst({
    where: { userId: user.id, businessId, clockOut: null },
    include: { job: { select: { title: true } } },
    orderBy: { clockIn: 'desc' },
  });

  // Open jobs for the clock-in job picker.
  const openJobs = await prisma.job.findMany({
    where: {
      businessId,
      status: { in: ['SCHEDULED', 'IN PROGRESS', 'NEW'] },
    },
    select: { id: true, title: true },
    orderBy: { date: 'asc' },
    take: 50,
  });

  const members = await prisma.user.findMany({
    where: { businessId },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });

  // Filters: members see only themselves; admins can filter the team.
  const memberFilter = isAdmin ? sp.member || '' : user.id;
  const fromDate = parseDateStart(sp.from) ?? startOfDayDaysAgo(29);
  const toDate = parseDateEnd(sp.to) ?? (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; })();

  const entries = await prisma.timeEntry.findMany({
    where: {
      businessId,
      ...(memberFilter ? { userId: memberFilter } : {}),
      clockIn: { gte: fromDate, lte: toDate },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      job: { select: { id: true, title: true } },
    },
    orderBy: { clockIn: 'desc' },
    take: 200,
  });

  const totalMinutes = entries.reduce(
    (s, e) => s + entryMinutes(e.clockIn, e.clockOut),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheets"
        subtitle="Clock in/out and review logged hours"
      />

      <ClockWidget
        activeSession={
          activeEntry
            ? {
                clockInISO: activeEntry.clockIn.toISOString(),
                jobTitle: activeEntry.job?.title ?? null,
              }
            : null
        }
        jobs={openJobs}
      />

      {/* Filters */}
      <Card className="p-4">
        <form method="GET" action="/timesheets" className="flex flex-col sm:flex-row gap-3 sm:items-end">
          {isAdmin && (
            <div className="flex-1">
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Team member
              </label>
              <select
                name="member"
                defaultValue={sp.member || ''}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-ink/30 focus:border-ink text-zinc-900"
              >
                <option value="">Everyone</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.email}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex-1">
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">From</label>
            <input
              type="date"
              name="from"
              defaultValue={toDateInputValue(fromDate)}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-ink/30 focus:border-ink text-zinc-900"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">To</label>
            <input
              type="date"
              name="to"
              defaultValue={toDateInputValue(toDate)}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-ink/30 focus:border-ink text-zinc-900"
            />
          </div>
          <button
            type="submit"
            className="bg-ink hover:bg-graphite text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm"
          >
            <Filter size={14} /> Apply
          </button>
        </form>
      </Card>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Total hours
          </p>
          <p className="text-2xl font-bold text-zinc-900 tracking-tight">
            {formatDuration(totalMinutes)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">{entries.length} entries</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Period
          </p>
          <p className="text-sm font-bold text-zinc-900 mt-2">
            {formatDateLabel(fromDate)} — {formatDateLabel(toDate)}
          </p>
        </Card>
      </div>

      {/* Entries */}
      <Card>
        {entries.length === 0 ? (
          <EmptyState
            icon={<Clock3 size={22} />}
            title="No time entries"
            description="Clock in above to start tracking, or add a manual entry for past work."
          />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {entries.map((e) => {
              const mins = entryMinutes(e.clockIn, e.clockOut);
              const isActive = !e.clockOut;
              const canDelete = isAdmin || e.userId === user.id;
              return (
                <li key={e.id} className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-smoke text-ink flex items-center justify-center shrink-0 font-bold text-xs">
                    {(e.user.name || e.user.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-zinc-900">
                        {e.user.name || e.user.email}
                      </p>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">
                          <Timer size={10} /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {formatDateLabel(e.clockIn)} · {formatClockTime(e.clockIn)}
                      {e.clockOut ? ` – ${formatClockTime(e.clockOut)}` : ' – now'}
                      {e.job ? (
                        <>
                          {' · '}
                          <Link
                            href={`/jobs/${e.job.id}`}
                            className="font-semibold text-ink hover:underline"
                          >
                            {e.job.title}
                          </Link>
                        </>
                      ) : (
                        ' · General work'
                      )}
                    </p>
                    {e.notes && (
                      <p className="text-xs text-zinc-600 mt-1 italic">“{e.notes}”</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-bold text-zinc-900 tabular-nums">
                      {formatDuration(mins)}
                    </span>
                    {canDelete && <DeleteEntryButton entryId={e.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ManualEntryForm
        members={members}
        jobs={openJobs}
        isAdmin={isAdmin}
        selfId={user.id}
      />
    </div>
  );
}
