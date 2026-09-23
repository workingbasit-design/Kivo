import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, Clock3, Briefcase, DollarSign, Trophy } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { PageHeader, Card, StatCard, EmptyState } from '@/components/ui';
import { entryMinutes, formatDuration } from '@/lib/timesheets';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';

type MemberRow = { id: string; name: string | null; email: string; role: string };

/** Pure aggregation helper (kept outside the component for lint purity). */
function buildPerformanceRows(
  members: MemberRow[],
  entries: Array<{ userId: string; clockIn: Date; clockOut: Date | null }>,
  completedJobs: Array<{ assignedToId: string | null; price: number }>
) {
  const now = Date.now();
  return members.map((m) => {
    const minutes = entries
      .filter((e) => e.userId === m.id)
      .reduce((s, e) => s + entryMinutes(e.clockIn, e.clockOut, now), 0);
    const mine = completedJobs.filter((j) => j.assignedToId === m.id);
    return {
      ...m,
      minutes,
      jobsCompleted: mine.length,
      revenue: mine.reduce((s, j) => s + (j.price || 0), 0),
    };
  });
}

function getRange(period: string, locale: Locale): { start: Date; end: Date; label: string } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (period === 'month') {
    const start = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0, 0);
    return {
      start,
      end,
      label: start.toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', { month: 'long', year: 'numeric' }),
    };
  }
  // This week (Monday start)
  const start = new Date(end);
  const day = (start.getDay() + 6) % 7; // days since Monday
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return { start, end, label: t(locale, 't10misc.teamreport.week') };
}

export default async function TeamPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { businessId } = await requireAuth();
  const locale: Locale = await getLocale();
  const tr = (path: string) => t(locale, path);
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = business?.currency;
  const sp = await searchParams;
  const period = sp.period === 'month' ? 'month' : 'week';
  const { start, end, label } = getRange(period, locale);

  const members = await prisma.user.findMany({
    where: { businessId },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  });

  const [entries, completedJobs] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { businessId, clockIn: { gte: start, lte: end } },
      select: { userId: true, clockIn: true, clockOut: true },
    }),
    prisma.job.findMany({
      where: {
        businessId,
        status: { in: ['COMPLETED', 'PAID'] },
        date: { gte: start, lte: end },
      },
      select: { assignedToId: true, price: true },
    }),
  ]);

  const rows = buildPerformanceRows(members, entries, completedJobs);

  const ranked = [...rows].sort((a, b) => b.minutes - a.minutes);
  const totalMinutes = rows.reduce((s, r) => s + r.minutes, 0);
  const totalJobs = rows.reduce((s, r) => s + r.jobsCompleted, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const top = ranked[0];

  return (
    <div className="space-y-6">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1.5 min-h-[44px] text-xs font-semibold text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft size={14} /> {tr('t10misc.teamreport.backToReports')}
      </Link>

      <PageHeader
        title={tr('t10misc.teamreport.title')}
        subtitle={tr('t10misc.teamreport.subtitle').replace('{label}', label)}
        actions={
          <div className="flex rounded-xl border border-zinc-200 overflow-hidden text-xs font-semibold">
            <Link
              href="/reports/team?period=week"
              className={cn(
                'px-4 min-h-[44px] inline-flex items-center transition-colors',
                period === 'week' ? 'bg-ink text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'
              )}
            >
              {tr('t10misc.teamreport.week')}
            </Link>
            <Link
              href="/reports/team?period=month"
              className={cn(
                'px-4 min-h-[44px] inline-flex items-center transition-colors',
                period === 'month' ? 'bg-ink text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'
              )}
            >
              {tr('t10misc.teamreport.month')}
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={tr('t10misc.teamreport.statHours').replace('{label}', label.toLowerCase())}
          value={formatDuration(totalMinutes)}
          sub={tr('t10misc.teamreport.memberCount')
            .replace('{count}', String(members.length))
            .replace('{s}', members.length === 1 ? '' : 's')}
          icon={<Clock3 size={16} />}
          accent="bg-smoke text-ink"
        />
        <StatCard
          label={tr('t10misc.teamreport.statJobs')}
          value={String(totalJobs)}
          sub={tr('t10misc.teamreport.statJobsSub')}
          icon={<Briefcase size={16} />}
          accent="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          label={tr('t10misc.teamreport.statRevenue')}
          value={formatMoney(totalRevenue, currency)}
          sub={tr('t10misc.teamreport.statRevenueSub')}
          icon={<DollarSign size={16} />}
          accent="bg-amber-100 text-amber-700"
        />
        <StatCard
          label={tr('t10misc.teamreport.statMostHours')}
          value={top && top.minutes > 0 ? top.name || top.email : '—'}
          sub={top && top.minutes > 0 ? formatDuration(top.minutes) : tr('t10misc.teamreport.noHoursLogged')}
          icon={<Trophy size={16} />}
          accent="bg-sky-100 text-sky-700"
        />
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title={tr('t10misc.teamreport.noMembersTitle')}
            description={tr('t10misc.teamreport.noMembersDesc')}
          />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-2.5 md:hidden p-4">
              {ranked.map((r, i) => (
                <div key={r.id} className="rounded-xl border border-zinc-200 bg-white p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-smoke text-ink flex items-center justify-center font-bold text-xs shrink-0">
                      {(r.name || r.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-zinc-900 truncate flex items-center gap-2">
                        {r.name || r.email}
                        {i === 0 && r.minutes > 0 && (
                          <Trophy size={13} className="text-amber-500 shrink-0" />
                        )}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        {r.role === 'ADMIN' ? tr('t10misc.teamreport.admin') : tr('t10misc.teamreport.member')}
                      </p>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-zinc-50 px-2 py-2">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        {tr('t10misc.teamreport.hoursCol')}
                      </dt>
                      <dd className="text-sm font-bold text-zinc-900 tabular-nums mt-0.5">
                        {formatDuration(r.minutes)}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-zinc-50 px-2 py-2">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        {tr('t10misc.teamreport.jobsCol')}
                      </dt>
                      <dd className="text-sm font-bold text-zinc-900 tabular-nums mt-0.5">
                        {r.jobsCompleted}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-zinc-50 px-2 py-2">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        {tr('t10misc.teamreport.revenueCol')}
                      </dt>
                      <dd className="text-sm font-bold text-zinc-900 tabular-nums mt-0.5">
                        {formatMoney(r.revenue, currency)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100">
                    <th className="px-5 py-3">{tr('t10misc.teamreport.memberCol')}</th>
                    <th className="px-5 py-3 text-right">{tr('t10misc.teamreport.hoursCol')}</th>
                    <th className="px-5 py-3 text-right">{tr('t10misc.teamreport.jobsCol')}</th>
                    <th className="px-5 py-3 text-right">{tr('t10misc.teamreport.revenueCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {ranked.map((r, i) => (
                    <tr key={r.id} className="hover:bg-zinc-50/60">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-smoke text-ink flex items-center justify-center font-bold text-xs shrink-0">
                            {(r.name || r.email).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-zinc-900 truncate flex items-center gap-2">
                              {r.name || r.email}
                              {i === 0 && r.minutes > 0 && (
                                <Trophy size={13} className="text-amber-500 shrink-0" />
                              )}
                            </p>
                            <p className="text-[11px] text-zinc-400">
                              {r.role === 'ADMIN'
                                ? tr('t10misc.teamreport.admin')
                                : tr('t10misc.teamreport.member')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-zinc-900 tabular-nums">
                        {formatDuration(r.minutes)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-zinc-700 tabular-nums">
                        {r.jobsCompleted}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-zinc-900 tabular-nums">
                        {formatMoney(r.revenue, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <p className="text-xs text-zinc-400">{tr('t10misc.teamreport.footnote')}</p>
    </div>
  );
}
