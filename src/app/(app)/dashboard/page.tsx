import React from "react";
import Link from "next/link";
import {
  Calendar,
  Banknote,
  AlertCircle,
  UserPlus,
  Clock,
  ChevronRight,
  Plus,
  CalendarDays,
  Receipt,
} from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDashboardStats } from "@/lib/dashboard";
import { getGrowthData } from "@/lib/growth";
import { generateDueJobs } from "@/lib/recurring";
import { formatDateLabel, hasJobTime, localeDateTag, localeMoneyTag } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import {
  PageHeader,
  Card,
  StatCard,
  StatusBadge,
  EmptyState,
  limeBtnClass,
  secondaryBtnClass,
} from "@/components/ui";

export default async function DashboardPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const L = (path: string) => t(locale, path);
  const moneyLocale = localeMoneyTag(locale);
  const dateLocale = localeDateTag(locale);
  const QUICK_ACTIONS = [
    { label: L("dashboard.newJob"), href: "/jobs/new", icon: Plus },
    { label: L("dashboard.newCustomer"), href: "/customers/new", icon: Plus },
    { label: L("dashboard.newQuote"), href: "/quotes/new", icon: Plus },
    { label: L("dashboard.newInvoice"), href: "/invoices/new", icon: Plus },
  ];

  // Lazy auto-generation: create jobs for any due recurring plans before
  // rendering, so jobs appear without the user tapping "Generate due jobs".
  // Best-effort — a failure here must never break the dashboard itself.
  try {
    await generateDueJobs(businessId);
  } catch (err) {
    console.error('[dashboard] recurring generation failed:', err);
  }

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = business?.currency;
  const stats = await getDashboardStats(businessId);
  // Best-effort: profile strength must never break the dashboard.
  let growth: Awaited<ReturnType<typeof getGrowthData>> | null = null;
  try {
    growth = await getGrowthData(businessId);
  } catch (err) {
    console.error('[dashboard] growth data failed:', err);
  }
  const todayLabel = formatDateLabel(new Date(), dateLocale);
  const rowDelay = (i: number) => ({ ["--row-delay" as string]: `${Math.min(i, 8) * 45}ms` });

  return (
    <div className="space-y-6">
      <PageHeader
        title={L("dashboard.title")}
        subtitle={todayLabel}
        actions={
          <Link href="/jobs/new" className={limeBtnClass}>
            <Plus size={16} /> {L("dashboard.newJob")}
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(
          [
            {
              label: L("dashboard.bookedToday"),
              value: formatMoney(stats.bookedToday, currency, moneyLocale),
              sub: L(stats.jobsLeftToday === 1 ? "dashboard.jobStillOpen" : "dashboard.jobsStillOpen").replace("{count}", String(stats.jobsLeftToday)),
              icon: <Calendar size={16} />,
              accent: "bg-smoke text-ink",
            },
            {
              label: L("dashboard.collected7"),
              value: formatMoney(stats.collectedThisWeek, currency, moneyLocale),
              sub: L("dashboard.paymentsReceived"),
              icon: <Banknote size={16} />,
              accent: "bg-emerald-100 text-emerald-700",
            },
            {
              label: L("dashboard.outstanding"),
              value: formatMoney(stats.outstanding, currency, moneyLocale),
              sub: L(stats.outstandingCount === 1 ? "dashboard.unpaidInvoice" : "dashboard.unpaidInvoices").replace("{count}", String(stats.outstandingCount)),
              icon: <AlertCircle size={16} />,
              accent: "bg-amber-100 text-amber-700",
            },
            {
              label: L("dashboard.newLeads"),
              value: String(stats.newLeads),
              sub: L("dashboard.totalCustomers").replace("{count}", String(stats.totalCustomers)),
              icon: <UserPlus size={16} />,
              accent: "bg-blue-100 text-blue-700",
            },
          ] as const
        ).map((c, i) => (
          <div key={c.label} className="ej-row-in" style={rowDelay(i)}>
            <StatCard
              label={c.label}
              value={c.value}
              sub={c.sub}
              icon={c.icon}
              accent={c.accent}
            />
          </div>
        ))}
      </div>

      {/* Profile strength — computed from the business's own data only */}
      {growth && growth.score < 100 && (
        <Link href="/insights#growth" className="block">
          <Card className="p-5 hover:border-ink/30 transition-colors">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 shrink-0">
                <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e4e4e7" strokeWidth="4" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="#1a1a1a"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${growth.score}, 100`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-zinc-900">
                  {growth.score}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-zinc-900">
                  {L("growth.scoreLabel")} · {growth.score} {L("growth.scoreOf")}
                </p>
                {growth.nextActions[0] && (
                  <p className="text-xs text-zinc-500 mt-1 truncate">
                    {L("growth.nextUp")}: {L(`growth.checkActions.${growth.nextActions[0].key}`)}
                  </p>
                )}
              </div>
              <ChevronRight size={16} className="text-zinc-400 shrink-0" />
            </div>
          </Card>
        </Link>
      )}

      {/* Today's schedule + payments due */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <Clock size={15} className="text-ink" /> {L("dashboard.todaysSchedule")}
            </h2>
            <Link
              href="/schedule"
              className="text-xs font-semibold text-ink hover:underline inline-flex items-center gap-1 min-h-[44px] px-2 -mr-2"
            >
              {L("dashboard.schedule")} <ChevronRight size={13} />
            </Link>
          </div>
          {stats.todayJobs.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={22} />}
              title={L("dashboard.nothingScheduled")}
              description={L("dashboard.breather")}
              action={
                <Link
                  href="/jobs/new"
                  className="bg-ink hover:bg-graphite text-white min-h-[44px] px-4 py-2.5 rounded-xl font-semibold text-xs inline-flex items-center gap-2 transition-colors"
                >
                  <Plus size={14} /> {L("dashboard.newJob")}
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-zinc-100 px-2 pb-2">
              {stats.todayJobs.map((job, i) => (
                <li key={job.id} className="ej-row-in" style={rowDelay(i)}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-50 transition-colors min-h-[56px]"
                  >
                    <div className="w-14 shrink-0 text-center">
                      <p className="text-xs font-bold text-zinc-900 tabular-nums">{hasJobTime(job.time) ? job.time : "—"}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{job.title}</p>
                      <p className="text-xs text-zinc-500 truncate">{job.customerName}</p>
                    </div>
                    <StatusBadge status={job.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <Receipt size={15} className="text-amber-600" /> {L("dashboard.paymentsDue")}
            </h2>
            <Link
              href="/invoices"
              className="text-xs font-semibold text-ink hover:underline inline-flex items-center gap-1 min-h-[44px] px-2 -mr-2"
            >
              {L("dashboard.invoices")} <ChevronRight size={13} />
            </Link>
          </div>
          {stats.dueInvoices.length === 0 ? (
            <EmptyState
              icon={<Banknote size={22} />}
              title={L("dashboard.allCaughtUp")}
              description={L("dashboard.noUnpaid")}
            />
          ) : (
            <ul className="divide-y divide-zinc-100 px-2 pb-2">
              {stats.dueInvoices.map((inv, i) => (
                <li key={inv.id} className="ej-row-in" style={rowDelay(i)}>
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-50 transition-colors min-h-[56px]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        {inv.number} · {inv.customerName}
                      </p>
                      <p className="text-xs text-zinc-500">{formatDateLabel(inv.date, dateLocale)}</p>
                    </div>
                    <p className="text-sm font-bold text-zinc-900 tabular-nums">{formatMoney(inv.outstanding, currency, moneyLocale)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Upcoming + jobs by status + quick actions */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <h2 className="text-sm font-bold text-zinc-900 mb-3">{L("dashboard.upcomingJobs")}</h2>
          {stats.upcomingJobs.length === 0 ? (
            <p className="text-sm text-zinc-500">{L("dashboard.noUpcoming")}</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {stats.upcomingJobs.map((job, i) => (
                <li key={job.id} className="ej-row-in" style={rowDelay(i)}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center gap-3 py-2.5 hover:bg-zinc-50 rounded-lg px-2 -mx-2 transition-colors min-h-[56px]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{job.title}</p>
                      <p className="text-xs text-zinc-500 truncate">
                        {job.customerName}
                        {hasJobTime(job.time) ? ` · ${job.time}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={job.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-zinc-100">
            <p className="w-full text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              {L("dashboard.jobsByStatus")}
            </p>
            {stats.jobsByStatus.length === 0 ? (
              <p className="text-sm text-zinc-500">{L("dashboard.noJobsYet")}</p>
            ) : (
              stats.jobsByStatus.map((g) => (
                <Link
                  key={g.status}
                  href="/jobs"
                  className="inline-flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-full px-3 py-2 min-h-[44px] text-xs font-semibold text-zinc-700 hover:border-smoke transition-colors"
                >
                  <StatusBadge status={g.status} />
                  <span className="tabular-nums">{g.count}</span>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-bold text-zinc-900 mb-3">{L("dashboard.quickActions")}</h2>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex flex-col items-center justify-center gap-2 bg-zinc-50 hover:bg-ink/5 border border-zinc-200 hover:border-smoke rounded-2xl p-4 min-h-[88px] transition-colors"
              >
                <span className="w-9 h-9 rounded-xl bg-ink/10 text-ink flex items-center justify-center">
                  <a.icon size={16} />
                </span>
                <span className="text-xs font-semibold text-zinc-700 text-center leading-tight">{a.label}</span>
              </Link>
            ))}
          </div>
          <Link
            href="/reports"
            className={secondaryBtnClass + " mt-4 w-full !justify-between"}
          >
            <span className="text-xs font-semibold">{L("dashboard.viewReports")}</span>
            <ChevronRight size={14} />
          </Link>
        </Card>
      </div>
    </div>
  );
}
