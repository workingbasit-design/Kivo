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
import { generateDueJobs } from "@/lib/recurring";
import { hasJobTime, formatJobTime, jobDisplayStatus, localeMoneyTag } from "@/lib/utils";
import MoneyText from "@/components/MoneyText";
import DateTimeText from "@/components/DateTimeText";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import {
  PageHeader,
  Card,
  StatusBadge,
  EmptyState,
  GlassIcon,
  primaryBtnClass,
} from "@/components/ui";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import AttentionBriefing from "@/components/AttentionBriefing";

export default async function DashboardPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const L = (path: string) => t(locale, path);
  const moneyLocale = localeMoneyTag(locale);

  // Lazy auto-generation: create jobs for any due recurring plans before
  // rendering, so jobs appear without the user tapping "Generate due jobs".
  const genPromise = (async () => {
    try {
      await generateDueJobs(businessId);
    } catch (err) {
      console.error('[dashboard] recurring generation failed:', err);
    }
  })();
  const [business] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { currency: true, logoUrl: true, timezone: true, regionCode: true } }),
    genPromise,
  ]);
  const currency = business?.currency;
  const [stats, counts] = await Promise.all([
    getDashboardStats(businessId, business),
    Promise.all([
      prisma.customer.count({ where: { businessId, archivedAt: null } }),
      prisma.quote.count({ where: { businessId } }),
      prisma.invoice.count({ where: { businessId } }),
      prisma.membership.count({ where: { businessId, status: 'ACTIVE' } }),
      prisma.googleConnection.findUnique({ where: { businessId }, select: { id: true } }),
    ]),
  ]);
  const [customerCount, quoteCount, invoiceCount, teamCount, googleConn] = counts;
  const jobCount = stats.totalJobs;
  const onboardingCompleted = {
    logo: !!business?.logoUrl,
    customer: customerCount > 0,
    job: jobCount > 0,
    quote: quoteCount > 0 || invoiceCount > 0,
    google: !!googleConn,
    team: teamCount > 1,
  };

  // E1: New business detection. If no jobs, invoices, or customers exist,
  // show the checklist-first layout instead of $0.00 stat cards.
  const isNewBusiness = jobCount === 0 && invoiceCount === 0 && customerCount === 0;

  // E1: Money section shows only metrics with data.
  const hasMoneyData =
    stats.collectedThisWeek > 0 ||
    stats.outstanding > 0 ||
    stats.readyToInvoice.length > 0 ||
    stats.newLeads > 0;

  const timezone = business?.timezone ?? 'America/Toronto';
  const rowDelay = (i: number) => ({ ["--row-delay" as string]: `${Math.min(i, 8) * 45}ms` });

  // E1: Date line reads "Saturday, October 17" (long weekday, long month, no year).
  const dateLine = (
    <DateTimeText date={new Date()} variant="dateline" timezone={timezone} locale={locale} />
  );

  // E1: New business layout — checklist replaces $0.00 cards.
  if (isNewBusiness) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={L("dashboard.title")}
          subtitle={dateLine}
          actions={
            <Link href="/jobs/new" className={primaryBtnClass}>
              <Plus size={16} /> {L("dashboard.newJob")}
            </Link>
          }
        />

        {/* Setup checklist is the screen for a new business. */}
        <OnboardingChecklist locale={locale} businessId={businessId} completed={onboardingCompleted} />

        {/* One clear action: create the first job. */}
        <Card className="p-6 text-center">
          <CalendarDays size={32} className="mx-auto mb-3 text-zinc-400" aria-hidden />
          <h2 className="text-lg font-bold text-zinc-900 mb-1">
            {L("dashboard.noJobsYet")}
          </h2>
          <p className="text-sm text-zinc-600 mb-4">
            {L("dashboard.breather")}
          </p>
          <Link href="/jobs/new" className={primaryBtnClass}>
            <Plus size={16} /> {L("dashboard.newJob")}
          </Link>
        </Card>
      </div>
    );
  }

  // E1: Existing business layout.
  // Order: needs you → today's agenda → money → checklist.
  return (
    <div className="space-y-6">
      <PageHeader
        title={L("dashboard.title")}
        subtitle={dateLine}
        actions={
          <Link href="/jobs/new" className={primaryBtnClass}>
            <Plus size={16} /> {L("dashboard.newJob")}
          </Link>
        }
      />

      {/* 1. What needs you (attention engine). Renders nothing when calm. */}
      <AttentionBriefing businessId={businessId} currency={currency} />

      {/* 2. Today's agenda: today's visits + upcoming. */}
      <Card>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2.5">
            <GlassIcon icon={<Clock size={14} />} tone="zinc" size="sm" /> {L("dashboard.todaysSchedule")}
          </h2>
          <Link
            href="/schedule"
            className="text-xs font-semibold text-ink hover:underline inline-flex items-center gap-1 min-h-[44px] px-2 -mr-2"
          >
            {L("dashboard.schedule")} <ChevronRight size={13} />
          </Link>
        </div>
        {stats.todayJobs.length === 0 && stats.upcomingJobs.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={22} />}
            title={L("dashboard.nothingScheduled")}
            description={L("dashboard.breather")}
          />
        ) : (
          <ul className="divide-y divide-zinc-100 px-2 pb-2">
            {/* Today's jobs first. */}
            {stats.todayJobs.map((job, i) => (
              <li key={`today-${job.id}`} className="ej-row-in" style={rowDelay(i)}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-50 transition-colors min-h-[56px]"
                >
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-xs font-bold text-zinc-900 tabular-nums">{hasJobTime(job.time) ? formatJobTime(job.time, locale) : "-"}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{job.title}</p>
                    <p className="text-xs text-zinc-700 truncate">{job.customerName}</p>
                  </div>
                  <StatusBadge status={jobDisplayStatus(job.status, job.date)} locale={locale} />
                </Link>
              </li>
            ))}
            {/* Upcoming jobs follow. */}
            {stats.upcomingJobs.map((job, i) => (
              <li key={`upcoming-${job.id}`} className="ej-row-in" style={rowDelay(stats.todayJobs.length + i)}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-50 transition-colors min-h-[56px]"
                >
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-xs font-bold text-zinc-900 tabular-nums">
                      <DateTimeText date={job.date} variant="short" timezone={timezone} locale={locale} />
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{job.title}</p>
                    <p className="text-xs text-zinc-700 truncate">
                      {job.customerName}
                      {hasJobTime(job.time) ? ` · ${formatJobTime(job.time, locale)}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={jobDisplayStatus(job.status, job.date)} locale={locale} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 3. Money: compact rows, only metrics with data. No $0.00 cards. */}
      {hasMoneyData && (
        <Card>
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2.5">
              <GlassIcon icon={<Banknote size={14} />} tone="emerald" size="sm" /> {L("dashboard.moneyTitle")}
            </h2>
          </div>
          <ul className="divide-y divide-zinc-100 px-2 pb-2">
            {stats.collectedThisWeek > 0 && (
              <li className="flex items-center justify-between px-3 py-3 min-h-[56px]">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{L("dashboard.collected7")}</p>
                  <p className="text-xs text-zinc-500">{L("dashboard.paymentsReceived")}</p>
                </div>
                <p className="text-base font-bold text-zinc-900 tabular-nums">
                  <MoneyText dollars={stats.collectedThisWeek} locale={locale} />
                </p>
              </li>
            )}
            {stats.outstanding > 0 && (
              <li>
                <Link
                  href="/invoices"
                  className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-zinc-50 transition-colors min-h-[56px]"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{L("dashboard.outstanding")}</p>
                    <p className="text-xs text-zinc-500">
                      {L(stats.outstandingCount === 1 ? "dashboard.unpaidInvoice" : "dashboard.unpaidInvoices").replace("{count}", String(stats.outstandingCount))}
                    </p>
                  </div>
                  <p className="text-base font-bold text-zinc-900 tabular-nums">
                    <MoneyText dollars={stats.outstanding} locale={locale} />
                  </p>
                </Link>
              </li>
            )}
            {stats.readyToInvoice.length > 0 && (
              <li>
                <Link
                  href="/invoices/new"
                  className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-zinc-50 transition-colors min-h-[56px]"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{L("dashboard.readyToInvoice")}</p>
                    <p className="text-xs text-zinc-500">
                      {L("dashboard.readyToInvoiceCount").replace("{count}", String(stats.readyToInvoice.length))}
                    </p>
                  </div>
                  <p className="text-base font-bold text-zinc-900 tabular-nums">
                    <MoneyText dollars={stats.readyToInvoice.reduce((s, j) => s + j.price, 0)} locale={locale} />
                  </p>
                </Link>
              </li>
            )}
            {stats.newLeads > 0 && (
              <li>
                <Link
                  href="/leads"
                  className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-zinc-50 transition-colors min-h-[56px]"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{L("dashboard.newLeads")}</p>
                    <p className="text-xs text-zinc-500">{L("dashboard.newLeadsHint")}</p>
                  </div>
                  <p className="text-base font-bold text-zinc-900 tabular-nums">{stats.newLeads}</p>
                </Link>
              </li>
            )}
          </ul>
        </Card>
      )}

      {/* 4. Setup checklist (until done). Renders nothing when complete. */}
      <OnboardingChecklist locale={locale} businessId={businessId} completed={onboardingCompleted} />
    </div>
  );
}
