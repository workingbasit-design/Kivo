import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, Clock3, Briefcase, DollarSign, Trophy } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
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

function getRange(period: string): { start: Date; end: Date; label: string } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (period === 'month') {
    const start = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0, 0);
    return {
      start,
      end,
      label: start.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }),
    };
  }
  // This week (Monday start)
  const start = new Date(end);
  const day = (start.getDay() + 6) % 7; // days since Monday
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return { start, end, label: 'This week' };
}

export default async function TeamPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { businessId } = await requireAuth();
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = business?.currency;
  const sp = await searchParams;
  const period = sp.period === 'month' ? 'month' : 'week';
  const { start, end, label } = getRange(period);

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
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft size={14} /> Back to reports
      </Link>

      <PageHeader
        title="Team performance"
        subtitle={`Hours, jobs and revenue per member — ${label}`}
        actions={
          <div className="flex rounded-xl border border-zinc-200 overflow-hidden text-xs font-semibold">
            <Link
              href="/reports/team?period=week"
              className={cn(
                'px-4 py-2.5 transition-colors',
                period === 'week' ? 'bg-[#6329d4] text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'
              )}
            >
              This week
            </Link>
            <Link
              href="/reports/team?period=month"
              className={cn(
                'px-4 py-2.5 transition-colors',
                period === 'month' ? 'bg-[#6329d4] text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'
              )}
            >
              This month
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={`Team hours · ${label.toLowerCase()}`}
          value={formatDuration(totalMinutes)}
          sub={`${members.length} member${members.length === 1 ? '' : 's'}`}
          icon={<Clock3 size={16} />}
          accent="bg-violet-100 text-[#6329d4]"
        />
        <StatCard
          label="Jobs completed"
          value={String(totalJobs)}
          sub="Assigned & finished"
          icon={<Briefcase size={16} />}
          accent="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          label="Revenue handled"
          value={formatMoney(totalRevenue, currency)}
          sub="Completed job value"
          icon={<DollarSign size={16} />}
          accent="bg-amber-100 text-amber-700"
        />
        <StatCard
          label="Most hours"
          value={top && top.minutes > 0 ? top.name || top.email : '—'}
          sub={top && top.minutes > 0 ? formatDuration(top.minutes) : 'No hours logged'}
          icon={<Trophy size={16} />}
          accent="bg-sky-100 text-sky-700"
        />
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title="No team members yet"
            description="Invite your team from Settings → Team, then their hours and completed jobs will show up here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3 text-right">Hours</th>
                  <th className="px-5 py-3 text-right">Jobs done</th>
                  <th className="px-5 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {ranked.map((r, i) => (
                  <tr key={r.id} className="hover:bg-zinc-50/60">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-100 text-[#6329d4] flex items-center justify-center font-bold text-xs shrink-0">
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
                            {r.role === 'ADMIN' ? 'Admin' : 'Member'}
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
        )}
      </Card>

      <p className="text-xs text-zinc-400">
        Hours come from timesheet entries (active sessions count up to now). Jobs and revenue
        count completed/paid jobs assigned to each member in the selected period.
      </p>
    </div>
  );
}
