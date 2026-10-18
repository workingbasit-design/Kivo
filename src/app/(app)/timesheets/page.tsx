import React from 'react';
import Link from 'next/link';
import { Clock3, Filter, Timer } from '@/components/icons';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

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
import { formatDateLabel, localeDateTag } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageTitle } from '../_components/PageTitle';
import { EmptyState, Card, Select, DateField, Button } from '@/components/kit';

function formatClockTime(d: Date | string, locale: string): string {
  return new Date(d).toLocaleTimeString(localeDateTag(locale), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; from?: string; to?: string }>;
}) {
  const { businessId, user, role } = await requireAuth();
  const sp = await searchParams;
  const isAdmin = role === 'ADMIN';
  const locale = await getLocale();
  const T = (k: string) => t(locale, `t10work.${k}`);
  const dateLocale = localeDateTag(locale);

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

  const members = (
    await prisma.membership.findMany({
      where: { businessId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: 'asc' } },
    })
  ).map((m) => m.user);

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

  const entriesLabel =
    entries.length === 1
      ? T('tsEntriesOne').replace('{count}', '1')
      : T('tsEntriesMany').replace('{count}', String(entries.length));

  return (
    <div className="space-y-5">
      <PageTitle
        title={T('tsTitle')}
        summary={T('tsSubtitle')}
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
            <div className="flex-1 min-w-0">
              <Select
                label={T('tsTeamMember')}
                name="member"
                defaultValue={sp.member || ''}
                options={[
                  { value: '', label: T('tsEveryone') },
                  ...members.map((m) => ({ value: m.id, label: m.name || m.email })),
                ]}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <DateField label={T('tsFrom')} name="from" defaultValue={toDateInputValue(fromDate)} />
          </div>
          <div className="flex-1 min-w-0">
            <DateField label={T('tsTo')} name="to" defaultValue={toDateInputValue(toDate)} />
          </div>
          <Button type="submit" variant="secondary" sm>
            <Filter size={14} /> {T('tsApply')}
          </Button>
        </form>
      </Card>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 ej-row-in">
          <p className="text-[11px] font-bold text-ink-2 mb-1">
            {T('tsTotalHours')}
          </p>
          <p className="text-2xl font-bold text-ink tracking-tight tabular-nums">
            {formatDuration(totalMinutes)}
          </p>
          <p className="text-xs text-ink-2 mt-1">{entriesLabel}</p>
        </Card>
        <Card className="p-5 ej-row-in">
          <p className="text-[11px] font-bold text-ink-2 mb-1">
            {T('tsPeriod')}
          </p>
          <p className="text-sm font-bold text-ink mt-2">
            {formatDateLabel(fromDate, dateLocale)} - {formatDateLabel(toDate, dateLocale)}
          </p>
        </Card>
      </div>

      {/* Entries */}
      <Card>
        {entries.length === 0 ? (
          <EmptyState
            icon={Clock3}
            title={T('tsEmptyTitle')}
            text={T('tsEmptyDesc')}
          />
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((e, i) => {
              const mins = entryMinutes(e.clockIn, e.clockOut);
              const isActive = !e.clockOut;
              const canDelete = isAdmin || e.userId === user.id;
              return (
                <li
                  key={e.id}
                  className="ej-row-in p-4 flex items-start gap-3"
                  // @ts-expect-error CSS custom property for the stagger animation
                  style={{ '--row-delay': `${Math.min(i, 12) * 35}ms` }}
                >
                  <div className="w-9 h-9 rounded-xl bg-smoke text-ink flex items-center justify-center shrink-0 font-bold text-xs">
                    {(e.user.name || e.user.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-ink">
                        {e.user.name || e.user.email}
                      </p>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-ok bg-ok-bg border border-line rounded-md px-2 py-0.5">
                          <Timer size={10} /> {T('tsActive')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-2 mt-0.5">
                      {formatDateLabel(e.clockIn, dateLocale)} · {formatClockTime(e.clockIn, locale)}
                      {e.clockOut ? ` - ${formatClockTime(e.clockOut, locale)}` : ` - ${T('tsNow')}`}
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
                        ` · ${T('tsGeneralWork')}`
                      )}
                    </p>
                    {e.notes && (
                      <p className="text-xs text-ink-2 mt-1 italic">“{e.notes}”</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-bold text-ink tabular-nums">
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
