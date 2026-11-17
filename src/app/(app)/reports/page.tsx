import React from "react";
import Link from "next/link";
import { forbidden, redirect } from "next/navigation";
import {
  TrendingUp,
  Trophy,
  ChevronRight,
  Wrench,
  CalendarClock,
  Users,
} from '@/components/icons';
import { requireAuth } from "@/lib/auth";
import { canSeePrices } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { getReportStats } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import { Card, Button } from '@/components/kit';
import { ReportBuilder, type SavedReportLite } from "@/components/ReportBuilder";
import { parseFlags, isFlagOn, FLAG_REPORTS } from "@/lib/feature-flags";
import { F9Reports } from "./f9-reports";
import { PageTitle } from '../_components/PageTitle';
import { StatusPill } from '../_components/status-ui';
import { EmptyState } from '@/components/kit';

const JOB_STATUS_ORDER = ["NEW", "SCHEDULED", "IN PROGRESS", "COMPLETED", "PAID", "CANCELLED"];

const frReports = {
  title: 'Rapports',
  eyebrow: 'Intelligence d’affaires',
  subtitle: 'La santé de votre entreprise - 6 derniers mois',
  emptyTitle: 'Aucune donnée pour le moment',
  emptyDesc:
    'Ajoutez des travaux, envoyez des factures et enregistrez des paiements - vos rapports se construiront ici.',
  createFirstJob: 'Créez votre premier travail',
  collectedLabel: 'Encaissé, 6 mois',
  paymentsReceived: 'Paiements reçus',
  avgJobLabel: 'Valeur moyenne par travail',
  completedPaid: 'Travaux terminés et payés',
  outstandingLabel: 'Impayé',
  unpaidInvoice: 'facture impayée',
  unpaidInvoices: 'factures impayées',
  winRateLabel: 'Taux de conversion',
  quote: 'soumission',
  quotes: 'soumissions',
  quoteTotalSuffix: 'au total',
  viewSchedule: 'Voir l’horaire',
  teamPerf: 'Rendement de l’équipe',
  teamPerfDesc: 'Travaux terminés, revenus et présence par membre de l’équipe.',
  viewReport: 'Voir le rapport',
  revenueByMonth: 'Revenus par mois',
  jobsByStatus: 'Travaux par statut',
  allJobs: 'Tous les travaux',
  noJobsYet: 'Aucun travail pour le moment.',
  jobsAllTime: 'au total',
  topCustomers: 'Meilleurs clients',
  completeJobsHint: 'Terminez des travaux pour voir vos meilleurs clients ici.',
  waitingToCollect: '{amount} à encaisser',
  acrossUnpaid:
    '{count} factures impayées. Un petit rappel aujourd’hui garde la trésorerie en santé.',
  reviewInvoices: 'Voir les factures',
  revenueByService: 'Revenus par service',
  revenueByServiceSub: 'Tâches terminées et payées',
  noServiceRevenue: 'Aucune tâche terminée pour le moment - liez vos tâches à votre carnet de prix pour voir la répartition.',
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
  title: 'Reports',
  eyebrow: 'Business intelligence',
  subtitle: 'How your business is doing - last 6 months',
  emptyTitle: 'No data yet',
  emptyDesc:
    'Add jobs, send invoices and record payments - your reports will build themselves here.',
  createFirstJob: 'Create your first job',
  collectedLabel: 'Collected, 6 months',
  paymentsReceived: 'Payments received',
  avgJobLabel: 'Avg job value',
  completedPaid: 'Completed & paid jobs',
  outstandingLabel: 'Outstanding',
  unpaidInvoice: 'unpaid invoice',
  unpaidInvoices: 'unpaid invoices',
  winRateLabel: 'Quote win rate',
  quote: 'quote',
  quotes: 'quotes',
  quoteTotalSuffix: 'total',
  viewSchedule: 'View schedule',
  teamPerf: 'Team performance',
  teamPerfDesc: 'Jobs completed, revenue, and attendance by team member.',
  viewReport: 'View report',
  revenueByMonth: 'Revenue by month',
  jobsByStatus: 'Jobs by status',
  allJobs: 'All jobs',
  noJobsYet: 'No jobs yet.',
  jobsAllTime: 'all time',
  topCustomers: 'Top customers',
  completeJobsHint: 'Complete some jobs to see your best customers here.',
  waitingToCollect: '{amount} waiting to be collected',
  acrossUnpaid:
    'Across {count} unpaid invoices. A nudge today keeps cash flow healthy.',
  reviewInvoices: 'Review invoices',
  revenueByService: 'Revenue by service',
  revenueByServiceSub: 'Completed & paid jobs',
  noServiceRevenue: 'No completed jobs yet - link jobs to your price book to see the breakdown.',
  upcomingWorkload: 'Upcoming workload',
  upcomingWorkloadSub: 'Next 14 days',
  jobsScheduled: 'jobs scheduled',
  jobScheduled: 'job scheduled',
  estimatedValue: 'Estimated value',
  nothingScheduled: 'Nothing scheduled in the next 14 days.',
  otherLabelJobs: 'jobs',
  otherLabelJob: 'job',
  yearLabel: 'Year',
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { businessId, role } = await requireAuth();

  // SEE_PRICES gate: reports are money data (the role matrix names
  // reports explicitly). Viewers without the capability (technicians)
  // are bounced to their dashboard before any stats load — same denial
  // style as the rest of the money pages. (The F9 check below keeps
  // forbidden(): it denies roles that CAN see prices, so a redirect
  // would be wrong there.)
  if (!canSeePrices(role)) {
    redirect('/dashboard');
  }

  const locale = await getLocale();
  const r = locale === 'fr' ? frReports : enReports;
  const moneyLocale = locale === 'fr' ? 'fr' : 'en';
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { currency: true, featureFlags: true },
  });
  const currency = business?.currency;

  // F9: per-business flag. When on, the six F9 reports render and the page
  // is Owner/Admin-only (dispatchers/technicians get a 403).
  const f9On = isFlagOn(parseFlags(business?.featureFlags), FLAG_REPORTS);
  if (f9On && role !== 'OWNER' && role !== 'ADMIN') {
    forbidden();
  }
  const { year: yearParam } = await searchParams;
  const thisYear = new Date().getFullYear();
  const parsedYear = Number(yearParam);
  const f9Year =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= thisYear + 1
      ? parsedYear
      : thisYear;

  const stats = await getReportStats(businessId, locale);
  const savedDb = await prisma.savedReport.findMany({
    where: { businessId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: { id: true, name: true, prompt: true, configJson: true, updatedAt: true },
  });
  const savedReports: SavedReportLite[] = savedDb.map((s) => ({
    id: s.id,
    name: s.name,
    prompt: s.prompt,
    configJson: s.configJson,
    updatedAt: s.updatedAt.toISOString(),
  }));

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
      <PageTitle
        title={r.title}
        eyebrow={r.eyebrow}
        summary={r.subtitle}
      />

      {/* Natural-language report builder */}
      <ReportBuilder locale={locale} currency={currency ?? null} savedReports={savedReports} />

      {!hasData ? (
        <Card>
          <EmptyState
            icon={<TrendingUp />}
            title={r.emptyTitle}
            text={r.emptyDesc}
          />
<div className="flex justify-center pb-10 -mt-6">
            <Button href="/jobs/new" variant="primary">
              {r.createFirstJob}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Stat cards (prototype `.report-stats`: one panel, four stats) */}
          <Card className="p-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
              {[
                { label: r.collectedLabel, value: formatMoney(stats.totalCollected, currency), sub: r.paymentsReceived },
                { label: r.avgJobLabel, value: formatMoney(stats.avgJobValue, currency), sub: r.completedPaid },
                {
                  label: r.outstandingLabel,
                  value: formatMoney(stats.outstanding, currency),
                  sub: `${stats.outstandingCount} ${stats.outstandingCount === 1 ? r.unpaidInvoice : r.unpaidInvoices}`,
                },
                {
                  label: r.winRateLabel,
                  value: stats.quoteWinRate === null ? "-" : `${stats.quoteWinRate}%`,
                  sub: `${stats.quotesSent} ${stats.quotesSent === 1 ? r.quote : r.quotes} ${r.quoteTotalSuffix}`,
                },
              ].map((stat) => (
                <div key={stat.label} className="min-w-0">
                  <span className="block text-xs text-ink-2 font-bold">{stat.label}</span>
                  <span className="num block text-[20px] leading-[1.25] font-medium text-ink tabular-nums">
                    {stat.value}
                  </span>
                  <small className="block text-[11px] text-ink-2 mt-0.5 leading-[1.3]">{stat.sub}</small>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Revenue by service */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Wrench size={14} className="text-ink-2" /> {r.revenueByService}
                </h2>
                <span className="text-[11px] text-ink-2 font-medium">{r.revenueByServiceSub}</span>
              </div>
              {stats.revenueByService.length === 0 ? (
                <>
                  <p className="text-sm text-ink-2">{r.noServiceRevenue}</p>
                  {/* Prototype empty visual: quiet bars, no fabricated values. */}
                  <div className="h-[34px] mt-3 flex items-end gap-2 opacity-45" aria-hidden="true">
                    <span className="w-[17%] h-[5px] rounded-full bg-line" />
                    <span className="w-[17%] h-[10px] rounded-full bg-line" />
                    <span className="w-[17%] h-[7px] rounded-full bg-line" />
                    <span className="w-[17%] h-[14px] rounded-full bg-line" />
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {stats.revenueByService.map((s) => (
                    <div key={s.name}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-ink-2 truncate mr-2">{s.name}</p>
                        <p className="text-xs font-bold text-ink shrink-0">
                          {formatMoney(s.revenue, currency, moneyLocale)}
                        </p>
                      </div>
                      <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-asphalt rounded-full transition-all"
                          style={{ width: `${Math.max(2, (s.revenue / maxServiceRevenue) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-ink-2 mt-1">
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
                <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                  <CalendarClock size={14} className="text-ink-2" /> {r.upcomingWorkload}
                </h2>
                <span className="text-[11px] text-ink-2 font-medium">{r.upcomingWorkloadSub}</span>
              </div>
              {stats.upcomingWorkload.count === 0 ? (
                <p className="text-sm text-ink-2">{r.nothingScheduled}</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold text-ink">
                        {stats.upcomingWorkload.count}
                      </p>
                      <p className="text-xs text-ink-2 mt-0.5">
                        {stats.upcomingWorkload.count === 1 ? r.jobScheduled : r.jobsScheduled}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-ink">
                        {formatMoney(stats.upcomingWorkload.totalPrice, currency, moneyLocale)}
                      </p>
                      <p className="text-xs text-ink-2 mt-0.5">{r.estimatedValue}</p>
                    </div>
                  </div>
                  <Link
                    href="/schedule"
                    className="text-xs font-semibold text-ink hover:underline inline-flex items-center gap-1"
                  >
                    {r.viewSchedule} <ChevronRight size={13} />
                  </Link>
                </div>
              )}
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Team performance shortcut (prototype full-width action card) */}
            <Link
              href="/reports/team"
              className="lg:col-span-2 bg-surface border border-line shadow-kit-card rounded-2xl p-5 flex items-center gap-3 hover:border-ok transition-colors"
            >
              <span className="w-8 h-8 grid place-items-center rounded-[10px] bg-ok-bg text-ok shrink-0">
                <Users size={17} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-ink">{r.teamPerf}</span>
                <span className="block text-xs text-ink-2 mt-0.5">
                  {r.teamPerfDesc}
                </span>
              </span>
              <span className="text-xs font-semibold text-ink inline-flex items-center gap-1 shrink-0">
                {r.viewReport} <ChevronRight size={13} />
              </span>
            </Link>

            {/* Revenue by month */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-ink">{r.revenueByMonth}</h2>
                <span className="text-[11px] text-ink-2 font-medium">{r.paymentsReceived}</span>
              </div>
              <div className="space-y-3">
                {stats.months.map((m) => (
                  <div key={m.key}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-ink-2 w-10">{m.label}</p>
                      <p className="text-xs font-bold text-ink">{formatMoney(m.revenue, currency)}</p>
                    </div>
                    <div className="h-[7px] bg-surface-2 rounded-full overflow-hidden ml-0 flex items-center">
                      {m.revenue > 0 ? (
                        <div
                          className="h-full bg-hivis rounded-full transition-all"
                          style={{ width: `${Math.max(2, (m.revenue / maxRevenue) * 100)}%` }}
                        />
                      ) : (
                        <span className="block w-[7px] h-[7px] rounded-full bg-line shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-ink-2 mt-1">
                      {m.jobs} {m.jobs === 1 ? r.otherLabelJob : r.otherLabelJobs}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Jobs by status */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-ink">{r.jobsByStatus}</h2>
                <Link
                  href="/jobs"
                  className="text-xs font-semibold text-ink hover:underline inline-flex items-center gap-1"
                >
                  {r.allJobs} <ChevronRight size={13} />
                </Link>
              </div>
              {totalJobs === 0 ? (
                <p className="text-sm text-ink-2">{r.noJobsYet}</p>
              ) : (
                <div className="space-y-3">
                  {orderedStatuses.map((g) => (
                    <div key={g.status} className="flex items-center gap-3">
                      <div className="w-32 shrink-0">
                        <StatusPill status={g.status} locale={locale} />
                      </div>
                      <div className="flex-1 h-[7px] bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-asphalt rounded-full"
                          style={{ width: `${Math.max(2, (g.count / totalJobs) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs font-bold text-ink w-8 text-right">{g.count}</p>
                    </div>
                  ))}
                  <p className="text-[11px] text-ink-2 pt-1">
                    {totalJobs} {totalJobs === 1 ? r.otherLabelJob : r.otherLabelJobs} {r.jobsAllTime}
                  </p>
                </div>
              )}

              {/* Top customers */}
              <div className="mt-6 pt-5 border-t border-line">
                <h2 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
                  <Trophy size={14} className="text-warn-text" /> {r.topCustomers}
                </h2>
                {stats.topCustomers.length === 0 ? (
                  <p className="text-sm text-ink-2">
                    {r.completeJobsHint}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {stats.topCustomers.map((c, i) => (
                      <li key={c.id}>
                        <Link
                          href={`/customers/${c.id}`}
                          className="flex items-center gap-3 bg-surface-2 hover:bg-surface-2 rounded-xl px-3 py-2.5 transition-colors"
                        >
                          <span
                            className={cn(
                              "w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0",
                              i === 0
                                ? "bg-warn-bg text-warn-text"
                                : "bg-line text-ink-2"
                            )}
                          >
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-ink truncate">{c.name}</p>
                            <p className="text-[11px] text-ink-2">
                              {c.jobs} {c.jobs === 1 ? r.otherLabelJob : r.otherLabelJobs}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-ink">{formatMoney(c.revenue, currency)}</p>
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
            <Card className="p-5 border-warn-line bg-warn-bg/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-ink">
                    {r.waitingToCollect.replace('{amount}', formatMoney(stats.outstanding, currency))}
                  </h2>
                  <p className="text-xs text-ink-2 mt-1">
                    {r.acrossUnpaid.replace('{count}', String(stats.outstandingCount))}
                  </p>
                </div>
                <Link
                  href="/invoices"
                  className="bg-hivis hover:brightness-105 text-hivis-ink px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm shrink-0"
                >
                  {r.reviewInvoices} <ChevronRight size={13} />
                </Link>
              </div>
            </Card>
          )}

          {/* Reporting snapshot footer (prototype): what feeds this page. */}
          <footer className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-ink-2">
            <span className="font-extrabold uppercase tracking-[0.09em]">
              {t(locale, 'reports.snapshot')}
            </span>
            <span className="flex-1 basis-full sm:basis-auto">
              {t(locale, 'reports.snapshotDesc')}
            </span>
            <details className="shrink-0">
              <summary className="cursor-pointer font-semibold text-ink hover:underline list-none inline-flex items-center gap-1">
                {t(locale, 'reports.dataDetails')} <ChevronRight size={13} />
              </summary>
              <p className="mt-2 text-xs text-ink-2 leading-relaxed max-w-[560px]">
                {t(locale, 'reports.dataDetailsBody')}
              </p>
            </details>
          </footer>

          {/* F9: the six flag-gated reports (Owner/Admin only — enforced
              above via forbidden() when the flag is on). The render call
              was missing since the F9 feature commit (2026-10-16): the
              component was built and gated but never mounted, so the
              sections, CSV export and drill-down links never existed. */}
          {f9On && (
            <F9Reports
              businessId={businessId}
              year={f9Year}
              locale={moneyLocale}
              currency={currency}
            />
          )}
        </>
      )}
    </div>
  );
}
