/**
 * Part C (dashboard rebuild): Last 8 weeks.
 *
 * Collected vs invoiced per week, current week marked with the lime
 * underline. Axis labels show the day, plus the month only when it
 * changes. "Show the numbers" opens a data table for screen readers.
 */
import { getLast8Weeks } from "@/lib/dashboard-sections";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { fillTemplate } from "@/lib/revenue";
import { formatMoney } from "@/lib/money";
import { localeMoneyTag } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Last8WeeksClient from "./Last8WeeksClient";

export default async function Last8Weeks({
  businessId,
  timezone,
  regionCode,
}: {
  businessId: string;
  timezone?: string | null;
  regionCode?: string | null;
}) {
  const locale: Locale = await getLocale();
  const moneyLocale = localeMoneyTag(locale);
  const tag = locale === "fr" ? "fr-CA" : "en-CA";
  const weeks = await getLast8Weeks(businessId, { timezone, regionCode });

  const max = Math.max(1, ...weeks.flatMap((w) => [w.collected, w.invoiced]));
  const monthName = (key: string) =>
    new Intl.DateTimeFormat(tag, { month: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1))
    );

  // Month label only when the month changes (pure: derived from the index).
  const labels = weeks.map((w, i) => {
    const prev = i === 0 ? null : weeks[i - 1].monthKey;
    return w.monthKey !== prev ? monthName(w.monthKey) : null;
  });

  const summary = fillTemplate(t(locale, "dashboard.last8WeeksSummary"), {
    collected: formatMoney(weeks.reduce((s, w) => s + w.collected, 0), null, moneyLocale),
    invoiced: formatMoney(weeks.reduce((s, w) => s + w.invoiced, 0), null, moneyLocale),
  });

  return (
    <section
      aria-label={t(locale, "dashboard.last8Weeks")}
      className="rounded-[24px] border border-zinc-200/70 bg-white p-5 dark:border-white/10 dark:bg-coal"
    >
      <h2 className="text-[17px] font-bold text-asphalt dark:text-white">
        {t(locale, "dashboard.last8Weeks")}
      </h2>
      <div className="mt-3 flex items-center gap-4 text-[13px] text-zinc-600 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-asphalt dark:bg-white" />
          {t(locale, "dashboard.legendCollected")}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-steel" />
          {t(locale, "dashboard.legendInvoiced")}
        </span>
      </div>

      <div role="img" aria-label={summary} className="mt-4 flex items-end gap-2.5">
        {weeks.map((w, i) => (
          <div key={w.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-[110px] w-full items-end justify-center gap-1">
              <span
                aria-hidden
                className="w-full max-w-[14px] rounded-t-[4px] bg-asphalt dark:bg-white"
                style={{ height: `${Math.max(3, (w.collected / max) * 110)}px` }}
              />
              <span
                aria-hidden
                className="w-full max-w-[14px] rounded-t-[4px] bg-steel"
                style={{ height: `${Math.max(3, (w.invoiced / max) * 110)}px` }}
              />
            </div>
            <span
              className={cn(
                "ej-figure text-[13px] font-bold tabular-nums",
                w.isCurrent
                  ? "border-b-[3px] border-hivis text-asphalt dark:text-white"
                  : "text-zinc-600 dark:text-zinc-400"
              )}
            >
              {w.dayLabel}
            </span>
            <span className="h-4 text-[11px] text-zinc-500 dark:text-zinc-500">{labels[i] ?? ""}</span>
          </div>
        ))}
      </div>

      <Last8WeeksClient
        weeks={weeks}
        locale={locale}
        showLabel={t(locale, "dashboard.showNumbers")}
        hideLabel={t(locale, "dashboard.hideNumbers")}
        weekLabel={t(locale, "dashboard.weekOf")}
        collectedLabel={t(locale, "dashboard.legendCollected")}
        invoicedLabel={t(locale, "dashboard.legendInvoiced")}
      />
    </section>
  );
}
