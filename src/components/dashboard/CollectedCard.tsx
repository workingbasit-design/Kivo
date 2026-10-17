"use client";

/**
 * Part C (dashboard rebuild): the Collected card.
 *
 * Dark asphalt panel (both modes) with the reflective stripe at the top.
 * This week / This month toggle compares against the same elapsed days of
 * the previous period, never the whole previous period. Today's bar is
 * striped, future days are dashed. Tapping a bar opens the money hub.
 */
import { useState } from "react";
import Link from "next/link";
import { TrendingUp } from "@/components/icons";
import type { CollectedData, CollectedPeriod } from "@/lib/dashboard-sections";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type Mode = "week" | "month";

/** Tiny template filler (client-safe): replaces {key} tokens. */
function fill(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

function formatWhole(amount: number, locale: "en" | "fr"): string {
  const tag = locale === "fr" ? "fr-CA" : "en-CA";
  return new Intl.NumberFormat(tag, {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function CollectedCard({
  data,
  locale,
  labels,
}: {
  data: CollectedData;
  locale: "en" | "fr";
  labels: {
    collected: string;
    thisWeek: string;
    thisMonth: string;
    trendUpTemplate: string;
    trendDownTemplate: string;
    periodWeek: string;
    periodMonth: string;
    invoiced: string;
    jobsDone: string;
    jobsDoneOfTemplate: string;
    chartSummaryTemplate: string;
    barLabelTemplate: string;
  };
}) {
  const tag = locale === "fr" ? "fr-CA" : "en-CA";
  const [mode, setMode] = useState<Mode>("week");
  const period: CollectedPeriod = data[mode];

  const weekdayLabel = (weekday: number) =>
    new Intl.DateTimeFormat(tag, { weekday: "narrow", timeZone: "UTC" }).format(
      new Date(Date.UTC(2026, 9, 12 + weekday)) // 2026-10-12 is a Monday
    );
  const monthLabel = (key: string) =>
    new Intl.DateTimeFormat(tag, { month: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1))
    );

  const max = Math.max(1, ...period.bars.map((b) => b.amount));
  const periodName = mode === "week" ? labels.periodWeek : labels.periodMonth;
  const trend =
    period.changePct == null
      ? null
      : period.changePct >= 0
        ? fill(labels.trendUpTemplate, { pct: period.changePct, period: periodName })
        : fill(labels.trendDownTemplate, { pct: -period.changePct, period: periodName });

  return (
    <section
      aria-label={fill(labels.chartSummaryTemplate, {
        total: formatMoney(period.total, null, locale),
        period: mode === "week" ? labels.thisWeek : labels.thisMonth,
      })}
      className="overflow-hidden rounded-[24px] bg-asphalt text-white dark:bg-soot"
    >
      <div className="ej-reflective-stripe h-2.5" aria-hidden />
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-zinc-300">{labels.collected}</h2>
          <div
            role="radiogroup"
            aria-label={labels.collected}
            className="inline-flex rounded-full bg-white/10 p-1"
          >
            {(["week", "month"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "min-h-[36px] px-4 rounded-full text-[13px] font-semibold transition-colors",
                  mode === m ? "bg-white text-asphalt" : "text-zinc-300 hover:text-white"
                )}
              >
                {m === "week" ? labels.thisWeek : labels.thisMonth}
              </button>
            ))}
          </div>
        </div>

        <p className="ej-figure mt-3 text-[44px] leading-none font-bold">
          {formatMoney(period.total, null, locale)}
        </p>
        {trend && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-hivis">
            <TrendingUp size={15} aria-hidden /> {trend}
          </p>
        )}

        <div className="mt-4 flex items-end gap-2" role="presentation">
          {period.bars.map((bar, i) => {
            const height = bar.isFuture ? 40 : Math.max(10, (bar.amount / max) * 120);
            return (
              <Link
                key={bar.key}
                href="/money"
                aria-label={fill(labels.barLabelTemplate, {
                  amount: formatMoney(bar.amount, null, locale),
                })}
                className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
              >
                {bar.isToday && bar.amount > 0 && (
                  <span className="text-[11px] font-bold tabular-nums text-white">
                    {formatWhole(bar.amount, locale)}
                  </span>
                )}
                <span
                  aria-hidden
                  className={cn(
                    "w-full max-w-[44px] rounded-[6px]",
                    bar.isFuture ? "ej-bar-future" : bar.isToday ? "ej-bar-today" : "bg-hivis"
                  )}
                  style={{ height: `${height}px` }}
                />
                <span className="text-[11px] font-semibold text-zinc-400">
                  {mode === "week"
                    ? weekdayLabel(bar.weekday)
                    : period.barMonths[i]
                      ? monthLabel(period.barMonths[i])
                      : ""}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
          <div>
            <p className="text-[13px] text-zinc-400">{labels.invoiced}</p>
            <p className="ej-figure text-[26px] font-bold tabular-nums">
              {formatMoney(period.invoiced, null, locale)}
            </p>
          </div>
          <div>
            <p className="text-[13px] text-zinc-400">{labels.jobsDone}</p>
            <p className="ej-figure text-[26px] font-bold tabular-nums">
              {fill(labels.jobsDoneOfTemplate, { done: period.jobsDone, total: period.jobsTotal })}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
