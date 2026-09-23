import React from "react";
import Link from "next/link";
import {
  TrendingUp,
  Briefcase,
  AlertCircle,
  Target,
  Trophy,
  ChevronRight,
  Wrench,
  CalendarClock,
} from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReportStats } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { getLocale } from "@/lib/i18n/server";
import { PageHeader, Card, StatCard, StatusBadge, EmptyState } from "@/components/ui";

const JOB_STATUS_ORDER = ["NEW", "SCHEDULED", "IN PROGRESS", "COMPLETED", "PAID", "CANCELLED"];

const frReports = {
  revenueByService: 'Revenus par service',
  revenueByServiceSub: 'Tâches terminées et payées',
  noServiceRevenue: 'Aucune tâche terminée pour le moment — liez vos tâches à votre carnet de prix pour voir la répartition.',
  upcomingWorkload: 'Charge de travail à venir',
  upcomingWorkloadSub: '14 prochains jours',
  jobsScheduled: 'tâches planifiées',
  jobScheduled: 'tâche planifiée',
  estimatedValue: 'Valeur estimée',
  nothingScheduled: "Rien de planifié dans les 14 prochains jours.",
  otherLabelJobs: 'tâches',
  otherLabelJob: 'tâche',
};

const enReports = {
  revenueByService: 'Revenue by service',
  revenueByServiceSub: 'Completed & paid jobs',
  noServiceRevenue: 'No completed jobs yet — link jobs to your price book to see the breakdown.',
  upcomingWorkload: 'Upcoming workload',
  upcomingWorkloadSub: 'Next 14 days',
  jobsScheduled: 'jobs scheduled',
  jobScheduled: 'job scheduled',
  estimatedValue: 'Estimated value',
  nothingScheduled: 'Nothing scheduled in the next 14 days.',
  otherLabelJobs: 'jobs',
  otherLabelJob: 'job',
};

export default async function ReportsPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const r = locale === 'fr' ? frReports : enReports;
  const moneyLocale = locale === 'fr' ? 'fr' : 'en';
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = business?.currency;
  const stats = await getReportStats(businessId, locale);

  const maxRevenue = Math.max(1, ...stats.months.map((m) => m.revenue));
  const maxServiceRevenue = Math.max(1, ...stats.revenueByService.map((s) => s.revenue));
  const hasData =
    stats.totalCollected > 0 ||
    stats.jobsByStatus.length > 0 ||
    stats.quotesSent > 0;

  const orderedStatuses = [...stats.jobsByStatus].sort(
    (a, b) => JOB_STATUS_ORDER.indexOf(a.status) - JOB_STATUS_ORDER.indexOf(b.status)
  );
  const totalJobs = orderedStatuses.reduce((s, g) => s + g.count, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="How your business is doing — last 6 months"
      />

      {!hasData ? (
        <Card>
          <EmptyState
            icon={<TrendingUp size={22} />}
            title="No data yet"
            description="Add jobs, send invoices and record payments — your reports will build themselves here."
            action={
              <Link
                href="/jobs/new"
                className="bg-ink hover:bg-graphite text-white px-4 py-2.5 rounded-xl font-semibold text-xs inline-flex items-center gap-2"
              >
                Create your first job
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Collected · 6 months"
              value={formatMoney(stats.totalCollected, currency)}
              sub="Payments received"
              icon={<TrendingUp size={16} />}
              accent="bg-emerald-100 text-emerald-700"
            />
            <StatCard
              label="Avg job value"
              value={formatMoney(stats.avgJobValue, currency)}
              sub="Completed & paid jobs"
              icon={<Briefcase size={16} />}
              accent="bg-smoke text-ink"
            />
            <StatCard
              label="Outstanding"
              value={formatMoney(stats.outstanding, currency)}
              sub={`${stats.outstandingCount} unpaid invoice${stats.outstandingCount === 1 ? "" : "s"}`}
              icon={<AlertCircle size={16} />}
              accent="bg-amber-100 text-amber-700"
            />
            <StatCard
              label="Quote win rate"
              value={stats.quoteWinRate === null ? "—" : `${stats.quoteWinRate}%`}
              sub={`${stats.quotesSent} quote${stats.quotesSent === 1 ? "" : "s"} total`}
              icon={<Target size={16} />}
              accent="bg-blue-100 text-blue-700"
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Revenue by service */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Wrench size={14} className="text-zinc-400" /> {r.revenueByService}
                </h2>
                <span className="text-[11px] text-zinc-400 font-medium">{r.revenueByServiceSub}</span>
              </div>
              {stats.revenueByService.length === 0 ? (
                <p className="text-sm text-zinc-500">{r.noServiceRevenue}</p>
              ) : (
                <div className="space-y-3">
                  {stats.revenueByService.map((s) => (
                    <div key={s.name}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-zinc-600 truncate mr-2">{s.name}</p>
                        <p className="text-xs font-bold text-zinc-900 shrink-0">
                          {formatMoney(s.revenue, currency, moneyLocale)}
                        </p>
                      </div>
                      <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-ink rounded-full transition-all"
                          style={{ width: `${Math.max(2, (s.revenue / maxServiceRevenue) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        {s.jobs} {s.jobs === 1 ? r.otherLabelJob : r.otherLabelJobs}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Upcoming workload */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <CalendarClock size={14} className="text-zinc-400" /> {r.upcomingWorkload}
                </h2>
                <span className="text-[11px] text-zinc-400 font-medium">{r.upcomingWorkloadSub}</span>
              </div>
              {stats.upcomingWorkload.count === 0 ? (
                <p className="text-sm text-zinc-500">{r.nothingScheduled}</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold text-zinc-900">
                        {stats.upcomingWorkload.count}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {stats.upcomingWorkload.count === 1 ? r.jobScheduled : r.jobsScheduled}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-zinc-900">
                        {formatMoney(stats.upcomingWorkload.totalPrice, currency, moneyLocale)}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">{r.estimatedValue}</p>
                    </div>
                  </div>
                  <Link
                    href="/schedule"
                    className="text-xs font-semibold text-ink hover:underline inline-flex items-center gap-1"
                  >
                    View schedule <ChevronRight size={13} />
                  </Link>
                </div>
              )}
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Team performance shortcut */}
            <Link
              href="/reports/team"
              className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-zinc-200/60 p-5 flex items-center justify-between gap-4 hover:border-smoke transition-colors"
            >
              <div>
                <h2 className="text-sm font-bold text-zinc-900">Team performance</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Jobs completed, revenue, and attendance by team member.
                </p>
              </div>
              <span className="text-xs font-semibold text-ink inline-flex items-center gap-1 shrink-0">
                View report <ChevronRight size={13} />
              </span>
            </Link>

            {/* Revenue by month */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-zinc-900">Revenue by month</h2>
                <span className="text-[11px] text-zinc-400 font-medium">Payments received</span>
              </div>
              <div className="space-y-3">
                {stats.months.map((m) => (
                  <div key={m.key}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-zinc-600 w-10">{m.label}</p>
                      <p className="text-xs font-bold text-zinc-900">{formatMoney(m.revenue, currency)}</p>
                    </div>
                    <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden ml-0">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          m.revenue > 0 ? "bg-ink" : "bg-zinc-200"
                        )}
                        style={{ width: `${Math.max(2, (m.revenue / maxRevenue) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      {m.jobs} job{m.jobs === 1 ? "" : "s"}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Jobs by status */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-zinc-900">Jobs by status</h2>
                <Link
                  href="/jobs"
                  className="text-xs font-semibold text-ink hover:underline inline-flex items-center gap-1"
                >
                  All jobs <ChevronRight size={13} />
                </Link>
              </div>
              {totalJobs === 0 ? (
                <p className="text-sm text-zinc-500">No jobs yet.</p>
              ) : (
                <div className="space-y-3">
                  {orderedStatuses.map((g) => (
                    <div key={g.status} className="flex items-center gap-3">
                      <div className="w-32 shrink-0">
                        <StatusBadge status={g.status} />
                      </div>
                      <div className="flex-1 h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-zinc-700 rounded-full"
                          style={{ width: `${Math.max(2, (g.count / totalJobs) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs font-bold text-zinc-900 w-8 text-right">{g.count}</p>
                    </div>
                  ))}
                  <p className="text-[11px] text-zinc-400 pt-1">
                    {totalJobs} job{totalJobs === 1 ? "" : "s"} all time
                  </p>
                </div>
              )}

              {/* Top customers */}
              <div className="mt-6 pt-5 border-t border-zinc-100">
                <h2 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2">
                  <Trophy size={14} className="text-amber-500" /> Top customers
                </h2>
                {stats.topCustomers.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    Complete some jobs to see your best customers here.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {stats.topCustomers.map((c, i) => (
                      <li key={c.id}>
                        <Link
                          href={`/customers/${c.id}`}
                          className="flex items-center gap-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl px-3 py-2.5 transition-colors"
                        >
                          <span
                            className={cn(
                              "w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0",
                              i === 0
                                ? "bg-amber-100 text-amber-700"
                                : "bg-zinc-200 text-zinc-600"
                            )}
                          >
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-900 truncate">{c.name}</p>
                            <p className="text-[11px] text-zinc-500">
                              {c.jobs} job{c.jobs === 1 ? "" : "s"}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-zinc-900">{formatMoney(c.revenue, currency)}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>

          {/* Outstanding summary */}
          {stats.outstandingCount > 0 && (
            <Card className="p-5 border-amber-200 bg-amber-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-zinc-900">
                    {formatMoney(stats.outstanding, currency)} waiting to be collected
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Across {stats.outstandingCount} unpaid invoice
                    {stats.outstandingCount === 1 ? "" : "s"}. A nudge today keeps cash flow healthy.
                  </p>
                </div>
                <Link
                  href="/invoices"
                  className="bg-ink hover:bg-graphite text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm shrink-0"
                >
                  Review invoices <ChevronRight size={13} />
                </Link>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
