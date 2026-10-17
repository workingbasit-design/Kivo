/**
 * Part C (dashboard rebuild): Today's visits timeline.
 *
 * Business-timezone timeline. Each visit shows the time, trade icon,
 * title, customer and area, the assigned person, and status. A lime "now"
 * marker sits between past and future visits. Unassigned visits show an
 * Assign button; tapping a visit opens it.
 */
import Link from "next/link";
import React from "react";
import { ChevronRight } from "@/components/icons";
import { getTodaysVisits, type VisitRow } from "@/lib/dashboard-sections";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { formatJobTime } from "@/lib/utils";
import TradeIcon from "./TradeIcon";
import { cn } from "@/lib/utils";

function timeMinutes(time: string | null): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function VisitTimelineRow({ visit, locale }: { visit: VisitRow; locale: Locale }) {
  // "8:30 AM" -> big "8:30" with "a.m." underneath; FR "8 h 30" has no suffix.
  const formatted = visit.time ? formatJobTime(visit.time, locale) : "";
  const m = /^(.*?)\s?(AM|PM)$/i.exec(formatted);
  const main = m ? m[1] : formatted;
  const suffix = m ? `${m[2].toLowerCase().replace("am", "a.m.").replace("pm", "p.m.")}` : "";
  return (
    <li className="relative flex gap-3 pl-1">
      {/* timeline dot */}
      <span
        aria-hidden
        className={cn(
          "absolute left-[47px] top-2 h-3 w-3 rounded-full border-2",
          visit.done ? "border-pine bg-pine" : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-coal"
        )}
      />
      <div className="w-11 shrink-0 pt-0.5 text-right">
        <p className="ej-figure text-[17px] font-bold leading-none text-asphalt tabular-nums dark:text-white">
          {main || "–"}
        </p>
        {suffix && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{suffix}</p>
        )}
      </div>
      <Link
        href={`/jobs/${visit.id}`}
        className="flex min-w-0 flex-1 items-start gap-2.5 rounded-xl py-1 pr-1 transition-colors hover:bg-zinc-50 dark:hover:bg-white/5"
      >
        <span aria-hidden className="mt-0.5 shrink-0 text-zinc-700 dark:text-zinc-300">
          <TradeIcon name={visit.tradeIcon} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug text-asphalt dark:text-white">
            {visit.title}
          </span>
          <span className="block truncate text-[13px] text-zinc-600 dark:text-zinc-400">
            {visit.customerName}
            {visit.area ? `, ${visit.area}` : ""}
          </span>
          {visit.assigneeName && (
            <span className="mt-1 flex items-center gap-1.5 text-[13px] text-zinc-600 dark:text-zinc-400">
              <span
                aria-hidden
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
              >
                {visit.assigneeInitials}
              </span>
              {visit.assigneeName}
            </span>
          )}
        </span>
        <span className="shrink-0 pt-0.5">
          {visit.done ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-pine/10 px-3 py-1.5 text-[13px] font-semibold text-pine">
              {t(locale, "dashboard.done")}
            </span>
          ) : visit.unassigned ? (
            <span className="inline-flex min-h-[40px] items-center rounded-full bg-safety/10 px-4 py-1.5 text-[13px] font-bold text-safety-ink dark:text-safety">
              {t(locale, "dashboard.assign")}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1.5 text-[13px] font-medium text-zinc-600 dark:border-white/15 dark:text-zinc-400">
              {t(locale, "dashboard.scheduled")}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

function NowMarker({ label, nowLabel }: { label: string; nowLabel: string }) {
  return (
    <li className="relative flex items-center gap-3 pl-1" aria-label={nowLabel}>
      <span className="w-11 shrink-0 text-right">
        <span className="inline-block rounded-lg bg-hivis px-2 py-1 text-[13px] font-bold text-asphalt tabular-nums">
          {label}
        </span>
      </span>
      <span aria-hidden className="absolute left-[47px] h-3.5 w-3.5 rounded-full border-[3px] border-hivis bg-asphalt" />
      <span aria-hidden className="h-0.5 flex-1 rounded bg-hivis/70" />
    </li>
  );
}

export default async function TodaysVisits({
  businessId,
  timezone,
  regionCode,
  technicianUserId,
}: {
  businessId: string;
  timezone?: string | null;
  regionCode?: string | null;
  technicianUserId?: string | null;
}) {
  const locale: Locale = await getLocale();
  const { visits, nowMinutes } = await getTodaysVisits(businessId, {
    timezone,
    regionCode,
    technicianUserId,
  });

  // The now marker sits before the first future visit.
  const markerAt = visits.findIndex((v) => {
    const m = timeMinutes(v.time);
    return m != null && m > nowMinutes;
  });
  const nowLabel = new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone ?? undefined,
  }).format(new Date());

  return (
    <section
      aria-label={t(locale, "dashboard.todaysVisits")}
      className="rounded-[24px] border border-zinc-200/70 bg-white p-5 dark:border-white/10 dark:bg-coal"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[17px] font-bold text-asphalt dark:text-white">
          {t(locale, "dashboard.todaysVisits")}
        </h2>
        <Link
          href="/schedule"
          className="inline-flex min-h-[44px] items-center gap-0.5 px-2 text-[13px] font-semibold text-asphalt underline underline-offset-2 dark:text-zinc-300"
        >
          {t(locale, "dashboard.schedule")} <ChevronRight size={14} />
        </Link>
      </div>
      {visits.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {t(locale, "dashboard.noVisitsToday")}
        </p>
      ) : (
        <ul className="relative space-y-4">
          {/* the vertical timeline */}
          <span aria-hidden className="absolute bottom-2 left-[52px] top-2 w-px bg-zinc-200 dark:bg-white/10" />
          {visits.map((v, i) => (
            <React.Fragment key={v.id}>
              {i === markerAt && <NowMarker label={nowLabel} nowLabel={t(locale, "dashboard.now")} />}
              <VisitTimelineRow visit={v} locale={locale} />
            </React.Fragment>
          ))}
          {markerAt === -1 && <NowMarker label={nowLabel} nowLabel={t(locale, "dashboard.now")} />}
        </ul>
      )}
    </section>
  );
}
