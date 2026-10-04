import Link from "next/link";
import { ArrowRight, Droplets, Gauge } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAttentionItems } from "@/lib/attention";
import { getMoneyLeaks, measuredLeakTotal } from "@/lib/money-leaks";
import { getHealthScore } from "@/lib/health-score";
import { getDashboardStats } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { fillTemplate } from "@/lib/revenue";
import { localeMoneyTag, formatDateLabel, localeDateTag } from "@/lib/utils";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { AttentionRow } from "@/components/AttentionBriefing";

function HealthRing({ score, locale }: { score: number; locale: Locale }) {
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e4e4e7" strokeWidth="4" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke={score >= 70 ? "#16a34a" : score >= 40 ? "#d97706" : "#dc2626"}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${score}, 100`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-zinc-900">
        {score}
      </span>
    </div>
  );
}

/**
 * Tomorrow's day-range in the business timezone, evaluated fresh per request.
 * Plain module helper (not a component) so the impure Date.now() stays out
 * of render.
 */
function tomorrowRange(tz: string): { start: Date; end: Date } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const key = fmt.format(new Date(Date.now() + 86_400_000));
  const [y, m, d] = key.split('-').map(Number);
  return {
    start: new Date(Date.UTC(y as number, (m as number) - 1, d as number)),
    end: new Date(Date.UTC(y as number, (m as number) - 1, (d as number) + 1)),
  };
}

export default async function OwnerPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const moneyLocale = localeMoneyTag(locale);
  const dateLocale = localeDateTag(locale);

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { currency: true, timezone: true, regionCode: true },
  });

  const [health, attention, leaks, stats] = await Promise.all([
    getHealthScore(businessId).catch((e) => {
      console.error("[owner] health failed:", e);
      return null;
    }),
    getAttentionItems(businessId, 5).catch((e) => {
      console.error("[owner] attention failed:", e);
      return [];
    }),
    getMoneyLeaks(businessId).catch((e) => {
      console.error("[owner] leaks failed:", e);
      return [];
    }),
    getDashboardStats(businessId, business).catch((e) => {
      console.error("[owner] stats failed:", e);
      return null;
    }),
  ]);

  // Tomorrow's schedule (business-local day).
  const { start: tomorrowStart, end: tomorrowEnd } = tomorrowRange(
    business?.timezone || 'America/Toronto',
  );
  const tomorrowJobs = await prisma.job
    .findMany({
      where: {
        businessId,
        date: { gte: tomorrowStart, lt: tomorrowEnd },
        status: { in: ["NEW", "SCHEDULED"] },
      },
      select: { id: true, title: true, time: true, customer: { select: { name: true } } },
      orderBy: { time: "asc" },
      take: 10,
    })
    .catch(() => []);

  const leakTotal = measuredLeakTotal(leaks);
  const money = (n: number) => formatMoney(n, business?.currency, moneyLocale);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={t(locale, "owner.title")}
        subtitle={t(locale, "owner.subtitle")}
      />

      {/* 1. How is my business doing? */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 px-1">
          {t(locale, "owner.questions.howDoing")}
        </h2>
        <Card className="p-5">
          {health?.total != null ? (
            <div className="flex items-center gap-5">
              <HealthRing score={health.total} locale={locale} />
              <div className="flex-1 space-y-2 min-w-0">
                <p className="text-sm font-bold text-zinc-900">
                  {t(locale, "owner.healthTitle")} · {health.total}{" "}
                  {t(locale, "owner.healthOutOf")}
                </p>
                {health.subs.map((s) => (
                  <div key={s.key} className="flex items-baseline justify-between gap-3">
                    <p className="text-xs text-zinc-600 truncate">
                      {t(locale, `attention.${s.titleKey}`)}
                      <span className="text-zinc-400">
                        {" "}
                        · {fillTemplate(t(locale, `attention.${s.explainKey}`), s.explainParams)}
                      </span>
                    </p>
                    <p className="text-xs font-bold text-zinc-900 shrink-0 tabular-nums">
                      {s.score != null ? s.score : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Gauge size={22} />}
              title={t(locale, "health.noData")}
              description={t(locale, "attention.emptyDesc")}
            />
          )}
        </Card>
      </section>

      {/* 2. What needs my attention? */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            {t(locale, "owner.questions.whatAttention")}
          </h2>
          <Link
            href="/attention"
            className="text-xs font-semibold text-ink hover:underline inline-flex items-center gap-1 min-h-[44px] px-2 -mr-2"
          >
            {t(locale, "attention.viewAll")} <ArrowRight size={13} />
          </Link>
        </div>
        {attention.length > 0 ? (
          <Card className="px-2 py-2 divide-y divide-zinc-100">
            {attention.map((item) => (
              <AttentionRow
                key={item.id}
                item={item}
                locale={locale}
                moneyLocale={moneyLocale}
                currency={business?.currency}
              />
            ))}
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={<ArrowRight size={22} />}
              title={t(locale, "attention.emptyTitle")}
              description={t(locale, "attention.emptyDesc")}
            />
          </Card>
        )}
      </section>

      {/* 3. Are we making money? — cash picture */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 px-1">
          {t(locale, "owner.questions.makingMoney")}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t(locale, "owner.cashOutstanding"), value: stats ? money(stats.outstanding) : "—", tone: "text-amber-700" },
            { label: t(locale, "owner.cashOverdue"), value: leaks.length ? money(leaks.find((l) => l.id === "overdue")?.amount ?? 0) : "—", tone: "text-red-700" },
            { label: t(locale, "owner.cashBooked"), value: stats ? money(stats.bookedToday) : "—", tone: "text-zinc-900" },
          ].map((c) => (
            <Card key={c.label} className="p-4">
              <p className="text-[11px] font-semibold text-zinc-500">{c.label}</p>
              <p className={`text-lg font-bold tabular-nums mt-1 ${c.tone}`}>{c.value}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* 4. Where are we losing money? */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 px-1">
          {t(locale, "owner.questions.losingMoney")}
        </h2>
        {leaks.length > 0 ? (
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <Droplets size={18} className="text-red-600" />
              <p className="text-sm">
                <span className="font-bold text-zinc-900 tabular-nums">{money(leakTotal)}</span>{" "}
                <span className="text-zinc-500">{t(locale, "leaks.totalAtRisk")}</span>
              </p>
            </div>
            <ul className="space-y-3">
              {leaks.map((leak) => (
                <li key={leak.id}>
                  <Link href={leak.href} className="flex items-center justify-between gap-3 group">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 group-hover:underline underline-offset-2">
                        {t(locale, `attention.${leak.titleKey}`)}
                        {!leak.measured && (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                            {t(locale, "scenarios.estimateLabel")}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {fillTemplate(t(locale, `attention.${leak.detailKey}`), leak.detailParams)}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-zinc-900 tabular-nums shrink-0">
                      {money(leak.amount)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-zinc-400 mt-4">
              {t(locale, "leaks.measuredNote")} {t(locale, "leaks.estimateNote")}
            </p>
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={<Droplets size={22} />}
              title={t(locale, "owner.leaksEmpty")}
              description=""
            />
          </Card>
        )}
      </section>

      {/* 5. What should I do tomorrow? */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 px-1">
          {t(locale, "owner.questions.tomorrow")}
        </h2>
        {tomorrowJobs.length > 0 ? (
          <Card className="px-2 py-2 divide-y divide-zinc-100">
            {tomorrowJobs.map((j) => (
              <Link
                key={j.id}
                href={`/jobs/${j.id}`}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-50 min-h-[56px]"
              >
                <p className="text-xs font-bold text-zinc-900 tabular-nums w-14 shrink-0">
                  {j.time || "—"}
                </p>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{j.title}</p>
                  <p className="text-xs text-zinc-500 truncate">{j.customer.name}</p>
                </div>
                <ArrowRight size={14} className="text-zinc-400 shrink-0" />
              </Link>
            ))}
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={<ArrowRight size={22} />}
              title={t(locale, "owner.tomorrowEmpty")}
              description={formatDateLabel(tomorrowStart, dateLocale)}
            />
          </Card>
        )}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs font-semibold text-ink hover:underline mt-3 min-h-[44px] px-1"
        >
          {t(locale, "owner.backToDashboard")}
        </Link>
      </section>
    </div>
  );
}
