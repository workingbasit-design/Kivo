import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeScenarios, getScenarioData } from "@/lib/scenarios";
import { formatMoney } from "@/lib/money";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import { localeMoneyTag } from "@/lib/utils";
import { PageHeader, Card, EmptyState } from "@/components/ui";

export default async function ScenariosPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const moneyLocale = localeMoneyTag(locale);
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { currency: true },
  });
  const money = (n: number | null) =>
    n == null ? "—" : formatMoney(n, business?.currency, moneyLocale);

  let data = null;
  try {
    data = computeScenarios(await getScenarioData(businessId));
  } catch (err) {
    console.error("[scenarios] failed:", err);
  }

  const hasData = data && (data.monthlyRevenue > 0 || data.jobsPerMonth > 0);

  const cards = hasData
    ? [
        {
          title: t(locale, "scenarios.revenueDrop.title"),
          rows: [
            [t(locale, "scenarios.revenueDrop.monthlyRevenue"), money(data!.monthlyRevenue)],
            [t(locale, "scenarios.revenueDrop.projected"), money(data!.revenueDrop.projected)],
            [t(locale, "scenarios.revenueDrop.shortfall"), money(data!.revenueDrop.shortfall)],
          ],
          note: t(locale, "scenarios.revenueDrop.note"),
        },
        {
          title: t(locale, "scenarios.priceRise.title"),
          rows: [
            [t(locale, "scenarios.priceRise.extraPerJob"), money(data!.priceRise.extraPerJob)],
            [t(locale, "scenarios.priceRise.monthlyUpside"), money(data!.priceRise.monthlyUpside)],
          ],
          note: t(locale, "scenarios.priceRise.note"),
        },
        {
          title: t(locale, "scenarios.hireTech.title"),
          rows: [
            [t(locale, "scenarios.hireTech.capacity"), data!.hireTech.jobsPerTechPerMonth ?? "—"],
            [t(locale, "scenarios.hireTech.extraCapacity"), data!.hireTech.extraCapacityJobs ?? "—"],
            [t(locale, "scenarios.hireTech.revenuePotential"), money(data!.hireTech.revenuePotential)],
          ],
          note: t(locale, "scenarios.hireTech.note"),
        },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={t(locale, "scenarios.title")}
        subtitle={t(locale, "scenarios.subtitle")}
      />
      {!hasData ? (
        <Card>
          <EmptyState
            icon={<FlaskConical size={22} />}
            title={t(locale, "health.noData")}
            description={t(locale, "scenarios.subtitle")}
          />
        </Card>
      ) : (
        cards.map((c) => (
          <Card key={c.title} className="p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-bold text-zinc-900">{c.title}</h2>
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 shrink-0">
                {t(locale, "scenarios.estimateLabel")}
              </span>
            </div>
            <dl className="space-y-2.5">
              {c.rows.map(([label, value]) => (
                <div key={label as string} className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-zinc-500">{label}</dt>
                  <dd className="text-sm font-bold text-zinc-900 tabular-nums shrink-0">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[11px] text-zinc-400 mt-4 leading-relaxed">{c.note}</p>
          </Card>
        ))
      )}
      <Link
        href="/owner"
        className="inline-flex items-center gap-1 text-xs font-semibold text-ink hover:underline min-h-[44px] px-1"
      >
        {t(locale, "owner.backToDashboard")}
      </Link>
    </div>
  );
}
