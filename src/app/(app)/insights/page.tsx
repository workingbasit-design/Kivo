import React from "react";
import Link from "next/link";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Wrench,
  Users,
  CalendarDays,
  Clock,
  MailWarning,
  UserCheck,
  ChevronRight,
  Lightbulb,
  Database,
} from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInsights } from "@/lib/insights";
import { formatMoney } from "@/lib/money";
import { getLocale } from "@/lib/i18n/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

const fr = {
  title: "Perspectives",
  subtitle: "Calculé à partir de vos propres données — rien n'est inventé.",
  basis: "Basé sur vos propres enregistrements",
  jobsWord: "tâches",
  paymentsWord: "paiements",
  quotesWord: "devis",
  noDataTitle: "Pas encore de perspectives",
  noDataDesc:
    "Terminez quelques tâches, enregistrez des paiements et envoyez des devis — vos perspectives apparaîtront ici, calculées à partir de votre activité réelle.",
  createJob: "Créer votre première tâche",
  momentum: "Dynamique des revenus",
  momentumSub: "Dernier mois complet vs le précédent",
  momentumUp: "en hausse",
  momentumDown: "en baisse",
  momentumFlat: "stable",
  momentumNone: "Ajoutez des paiements pour voir la tendance.",
  trend: "Revenus · 6 derniers mois",
  trendSub: "Paiements encaissés",
  margins: "Marges par service",
  marginsSub: "Tâches terminées et payées, moins les dépenses",
  noMargins: "Terminez des tâches liées à votre carnet de prix pour voir les marges.",
  marginLabel: "marge",
  costsLabel: "coûts",
  jobsCount: (n: number) => `${n} tâche${n === 1 ? "" : "s"}`,
  clv: "Valeur vie client",
  clvSub: "Revenu moyen par client payant",
  repeatRate: "clients reviennent",
  payingCustomers: "clients payants",
  noClv: "Terminez et payez des tâches pour calculer la valeur vie client.",
  seasonal: "Demande saisonnière",
  seasonalSub: "Tâches moyennes par mois, tout historique",
  noSeasonal: "Pas encore assez d'historique pour dégager une saisonnalité.",
  scheduling: "Planification intelligente",
  schedulingSub: "D'après vos tâches passées",
  noScheduling: "Planifiez des tâches pour recevoir des suggestions.",
  bestDay: "Votre journée la plus occupée",
  bestValue: "meilleure valeur moyenne",
  suggestionBusy: (d: string) =>
    `Historiquement, le ${d} est votre journée la plus chargée — réservez les grosses tâches tôt ce jour-là.`,
  suggestionValue: (d: string) =>
    `La valeur moyenne par tâche est la plus élevée le ${d} — idéal pour les tâches à forte valeur.`,
  suggestionSpread: (d: string) =>
    `Le ${d} est généralement plus calme — une bonne fenêtre pour les tâches flexibles ou les rattrapages.`,
  followups: "Relances de devis",
  followupsSub: "Envoyés il y a plus de 7 jours, sans réponse",
  noFollowups: "Aucun devis en attente — belle réactivité.",
  winRate: "Taux de conversion des devis",
  daysWaiting: (n: number) => `en attente depuis ${n} j`,
  followUpCta: "Relancer",
  viewQuote: "Voir le devis",
  team: "Utilisation de l'équipe",
  teamSub: "Tâches terminées et payées par technicien",
  noTeam: "Assignez des techniciens à vos tâches pour voir l'utilisation.",
  smartTakeaways: "À retenir",
  perJob: "/tâche",
};

const en = {
  title: "Insights",
  subtitle: "Computed from your own data — nothing is made up.",
  basis: "Based on your own records",
  jobsWord: "jobs",
  paymentsWord: "payments",
  quotesWord: "quotes",
  noDataTitle: "No insights yet",
  noDataDesc:
    "Complete some jobs, record payments and send quotes — your insights will appear here, computed from your real activity.",
  createJob: "Create your first job",
  momentum: "Revenue momentum",
  momentumSub: "Last complete month vs the one before",
  momentumUp: "up",
  momentumDown: "down",
  momentumFlat: "flat",
  momentumNone: "Record payments to see the trend.",
  trend: "Revenue · last 6 months",
  trendSub: "Payments collected",
  margins: "Margins by service",
  marginsSub: "Completed & paid jobs, minus expenses",
  noMargins: "Complete jobs linked to your price book to see margins.",
  marginLabel: "margin",
  costsLabel: "costs",
  jobsCount: (n: number) => `${n} job${n === 1 ? "" : "s"}`,
  clv: "Customer lifetime value",
  clvSub: "Average collected revenue per paying customer",
  repeatRate: "of customers come back",
  payingCustomers: "paying customers",
  noClv: "Complete and pay jobs to compute customer lifetime value.",
  seasonal: "Seasonal demand",
  seasonalSub: "Average jobs per month, all history",
  noSeasonal: "Not enough history yet to spot seasonality.",
  scheduling: "Smart scheduling",
  schedulingSub: "From your past jobs",
  noScheduling: "Schedule jobs to get suggestions.",
  bestDay: "Your busiest day",
  bestValue: "best average value",
  suggestionBusy: (d: string) =>
    `Historically, ${d} is your busiest day — book big jobs early that day.`,
  suggestionValue: (d: string) =>
    `Average job value peaks on ${d} — a good slot for high-value work.`,
  suggestionSpread: (d: string) =>
    `${d} is usually quieter — a good window for flexible jobs or catch-up.`,
  followups: "Quote follow-ups",
  followupsSub: "Sent 7+ days ago, no response",
  noFollowups: "No quotes waiting — nice responsiveness.",
  winRate: "Quote win rate",
  daysWaiting: (n: number) => `waiting ${n}d`,
  followUpCta: "Follow up",
  viewQuote: "View quote",
  team: "Team utilization",
  teamSub: "Completed & paid jobs per technician",
  noTeam: "Assign technicians to jobs to see utilization.",
  smartTakeaways: "Smart takeaways",
  perJob: "/job",
};

function weekdayName(w: number, locale: "en" | "fr"): string {
  return new Date(2026, 8, 20 + w).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", {
    weekday: "long",
  });
}

export default async function InsightsPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const r = locale === "fr" ? fr : en;
  const moneyLocale = locale === "fr" ? "fr" : "en";
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { currency: true },
  });
  const currency = business?.currency;

  const ins = await getInsights(businessId, locale);
  const hasData = ins.basisJobs > 0 || ins.basisPayments > 0 || ins.basisQuotes > 0;

  const maxTrend = Math.max(1, ...ins.revenueTrend.map((p) => p.revenue));
  const maxMargin = Math.max(1, ...ins.serviceMargins.map((s) => Math.abs(s.margin)));
  const maxSeason = Math.max(1, ...ins.seasonalDemand.map((s) => s.jobs));
  const maxTech = Math.max(1, ...ins.technicians.map((t) => t.jobs));

  const momentum = ins.revenueMomentumPct;
  const MomentumIcon = momentum === null || momentum === 0 ? Minus : momentum > 0 ? TrendingUp : TrendingDown;

  // Smart scheduling takeaways
  const takeaways: string[] = [];
  if (ins.busiestWeekday !== null) {
    const dayName = weekdayName(ins.busiestWeekday, locale);
    takeaways.push(r.suggestionBusy(dayName));
    const bestValueDay = ins.avgValueByWeekday
      .map((v, i) => ({ v, i }))
      .filter((x) => x.v !== null)
      .sort((a, b) => (b.v ?? 0) - (a.v ?? 0))[0];
    if (bestValueDay && bestValueDay.i !== ins.busiestWeekday) {
      takeaways.push(r.suggestionValue(weekdayName(bestValueDay.i, locale)));
    }
    const quietest = ins.avgValueByWeekday
      .map((v, i) => ({ v, i }))
      .filter((x) => x.v !== null)
      .sort((a, b) => (a.v ?? 0) - (b.v ?? 0))[0];
    if (quietest && quietest.i !== ins.busiestWeekday && quietest.i !== bestValueDay?.i) {
      takeaways.push(r.suggestionSpread(weekdayName(quietest.i, locale)));
    }
  }

  const bestService = ins.serviceMargins[0] ?? null;
  const worstService = ins.serviceMargins.length > 1 ? ins.serviceMargins[ins.serviceMargins.length - 1] : null;

  return (
    <div className="space-y-6">
      <PageHeader title={r.title} subtitle={r.subtitle} />
      <p className="text-xs text-zinc-500 inline-flex items-center gap-1.5 -mt-3">
        <Database size={13} className="text-zinc-400" />
        {r.basis}: {ins.basisJobs} {r.jobsWord} · {ins.basisPayments} {r.paymentsWord} ·{" "}
        {ins.basisQuotes} {r.quotesWord}
      </p>

      {!hasData ? (
        <Card>
          <EmptyState
            icon={<Sparkles size={22} />}
            title={r.noDataTitle}
            description={r.noDataDesc}
            action={
              <Link
                href="/jobs/new"
                className="bg-ink hover:bg-graphite text-white px-4 py-2.5 rounded-xl font-semibold text-xs inline-flex items-center gap-2"
              >
                {r.createJob}
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {/* Momentum + win rate */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5">
              <p className="text-xs font-semibold text-zinc-500">{r.momentum}</p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-zinc-900">
                <MomentumIcon
                  size={22}
                  className={momentum !== null && momentum > 0 ? "text-emerald-600" : momentum !== null && momentum < 0 ? "text-red-600" : "text-zinc-400"}
                />
                {momentum === null ? "—" : `${momentum > 0 ? "+" : ""}${momentum}%`}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                {momentum === null ? r.momentumNone : `${r.momentumSub} · ${momentum === 0 ? r.momentumFlat : momentum > 0 ? r.momentumUp : r.momentumDown}`}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-semibold text-zinc-500">{r.winRate}</p>
              <p className="mt-2 text-2xl font-bold text-zinc-900">
                {ins.quoteWinRatePct === null ? "—" : `${ins.quoteWinRatePct}%`}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">{ins.staleQuotes.length > 0 ? `${ins.staleQuotes.length} ${r.followupsSub.toLowerCase()}` : r.noFollowups}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-semibold text-zinc-500">{r.clv}</p>
              <p className="mt-2 text-2xl font-bold text-zinc-900">
                {ins.customerLifetimeValue
                  ? formatMoney(ins.customerLifetimeValue.avgValue, currency, moneyLocale)
                  : "—"}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                {ins.customerLifetimeValue
                  ? `${ins.customerLifetimeValue.repeatRatePct}% ${r.repeatRate} · ${ins.customerLifetimeValue.payingCustomers} ${r.payingCustomers}`
                  : r.noClv}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-semibold text-zinc-500">{r.bestDay}</p>
              <p className="mt-2 text-2xl font-bold text-zinc-900 capitalize">
                {ins.busiestWeekday === null ? "—" : weekdayName(ins.busiestWeekday, locale)}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">{r.schedulingSub}</p>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Revenue trend */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <TrendingUp size={14} className="text-zinc-400" /> {r.trend}
                </h2>
                <span className="text-[11px] text-zinc-400 font-medium">{r.trendSub}</span>
              </div>
              <div className="space-y-3">
                {ins.revenueTrend.map((p) => (
                  <div key={p.key}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-zinc-600 w-10">{p.label}</p>
                      <p className="text-xs font-bold text-zinc-900">
                        {formatMoney(p.revenue, currency, moneyLocale)}
                      </p>
                    </div>
                    <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-lime rounded-full transition-all"
                        style={{ width: `${Math.max(2, (p.revenue / maxTrend) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Service margins */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Wrench size={14} className="text-zinc-400" /> {r.margins}
                </h2>
                <span className="text-[11px] text-zinc-400 font-medium">{r.marginsSub}</span>
              </div>
              {ins.serviceMargins.length === 0 ? (
                <p className="text-sm text-zinc-500">{r.noMargins}</p>
              ) : (
                <div className="space-y-3">
                  {ins.serviceMargins.map((s) => (
                    <div key={`${s.serviceId ?? "none"}-${s.name}`}>
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <p className="text-xs font-semibold text-zinc-600 truncate">{s.name}</p>
                        <p className={cn("text-xs font-bold shrink-0", s.margin >= 0 ? "text-emerald-700" : "text-red-600")}>
                          {formatMoney(s.margin, currency, moneyLocale)}{" "}
                          <span className="font-medium text-zinc-400">
                            {s.marginPct === null ? "" : `${s.marginPct}%`}
                          </span>
                        </p>
                      </div>
                      <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", s.margin >= 0 ? "bg-ink" : "bg-red-400")}
                          style={{ width: `${Math.max(2, (Math.abs(s.margin) / maxMargin) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        {r.jobsCount(s.jobs)} · {r.costsLabel}: {formatMoney(s.costs, currency, moneyLocale)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Seasonal demand */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <CalendarDays size={14} className="text-zinc-400" /> {r.seasonal}
                </h2>
                <span className="text-[11px] text-zinc-400 font-medium">{r.seasonalSub}</span>
              </div>
              {ins.seasonalDemand.every((s) => s.jobs === 0) ? (
                <p className="text-sm text-zinc-500">{r.noSeasonal}</p>
              ) : (
                <div className="flex items-end gap-1.5 h-32">
                  {ins.seasonalDemand.map((s) => (
                    <div key={s.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <div
                        className="w-full bg-ink/85 rounded-t-md"
                        style={{ height: `${Math.max(4, (s.jobs / maxSeason) * 104)}px` }}
                        title={`${s.month}: ${s.jobs}`}
                      />
                      <span className="text-[9px] text-zinc-400 font-medium truncate">{s.month}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Team utilization */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <UserCheck size={14} className="text-zinc-400" /> {r.team}
                </h2>
                <span className="text-[11px] text-zinc-400 font-medium">{r.teamSub}</span>
              </div>
              {ins.technicians.length === 0 ? (
                <p className="text-sm text-zinc-500">{r.noTeam}</p>
              ) : (
                <div className="space-y-3">
                  {ins.technicians.slice(0, 8).map((tch) => (
                    <div key={tch.name}>
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <p className="text-xs font-semibold text-zinc-600 truncate">{tch.name}</p>
                        <p className="text-xs font-bold text-zinc-900 shrink-0">
                          {r.jobsCount(tch.jobs)} · {formatMoney(tch.revenue, currency, moneyLocale)}
                        </p>
                      </div>
                      <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-ink rounded-full transition-all"
                          style={{ width: `${Math.max(2, (tch.jobs / maxTech) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Smart takeaways */}
          {takeaways.length > 0 && (
            <Card className="p-5 border-lime/50 bg-lime/5">
              <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2 mb-3">
                <Lightbulb size={14} className="text-amber-500" /> {r.smartTakeaways}
              </h2>
              <ul className="space-y-2">
                {takeaways.map((tk, i) => (
                  <li key={i} className="text-sm text-zinc-700 flex gap-2">
                    <Clock size={14} className="text-zinc-400 shrink-0 mt-0.5" />
                    {tk}
                  </li>
                ))}
                {bestService && worstService && bestService.marginPct !== null && worstService.marginPct !== null && (
                  <li className="text-sm text-zinc-700 flex gap-2">
                    <Wrench size={14} className="text-zinc-400 shrink-0 mt-0.5" />
                    {locale === "fr"
                      ? `« ${bestService.name} » a votre meilleure marge (${bestService.marginPct}%), « ${worstService.name} » la plus faible (${worstService.marginPct}%) — revoyez vos prix ou vos coûts.`
                      : `“${bestService.name}” has your best margin (${bestService.marginPct}%), “${worstService.name}” the lowest (${worstService.marginPct}%) — review pricing or costs.`}
                  </li>
                )}
              </ul>
            </Card>
          )}

          {/* Quote follow-ups */}
          {ins.staleQuotes.length > 0 && (
            <Card className="p-5 border-amber-200 bg-amber-50/50">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <MailWarning size={14} className="text-amber-500" /> {r.followups}
                </h2>
                <span className="text-[11px] text-zinc-400 font-medium">{r.followupsSub}</span>
              </div>
              <ul className="space-y-2">
                {ins.staleQuotes.slice(0, 6).map((q) => (
                  <li
                    key={q.id}
                    className="flex items-center gap-3 bg-white rounded-xl border border-amber-100 px-3 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        {q.number} · {q.customerName}
                      </p>
                      <p className="text-[11px] text-amber-600 font-medium">{r.daysWaiting(q.daysWaiting)}</p>
                    </div>
                    <p className="text-sm font-bold text-zinc-900 shrink-0">
                      {formatMoney(q.total, currency, moneyLocale)}
                    </p>
                    <Link
                      href={`/quotes/${q.id}`}
                      className="text-xs font-semibold text-ink hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      {r.followUpCta} <ChevronRight size={13} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* CLV detail */}
          {ins.customerLifetimeValue && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Users size={14} className="text-zinc-400" /> {r.clv}
                </h2>
                <span className="text-[11px] text-zinc-400 font-medium">{r.clvSub}</span>
              </div>
              <div className="flex items-end gap-6">
                <div>
                  <p className="text-3xl font-bold text-zinc-900">
                    {formatMoney(ins.customerLifetimeValue.avgValue, currency, moneyLocale)}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {r.perJob.replace("/", "")} · {ins.customerLifetimeValue.payingCustomers} {r.payingCustomers}
                  </p>
                </div>
                <div className="pb-1">
                  <p className="text-xl font-bold text-emerald-700">
                    {ins.customerLifetimeValue.repeatRatePct}%
                  </p>
                  <p className="text-xs text-zinc-500">{r.repeatRate}</p>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
