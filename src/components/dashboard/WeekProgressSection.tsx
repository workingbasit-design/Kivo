/**
 * Scroll lesson 5 — forgiving weekly progress (server only).
 *
 * Seven dots for the current week (Mon…Sun) plus the week's totals.
 * A dot is filled when that day had a completed job, an issued invoice,
 * or a collected payment. A quiet day is just an unfilled dot — there is
 * no streak, no red, no punishment copy anywhere in this section.
 * Future days are dimmed: not yet happened, not failed. Today gets a
 * ring so the pro can orient at a glance. Technicians see the jobs-only
 * variant (money rows skipped by the fetcher).
 *
 * Motion Edition: the strip is the weekly pulse — each day is
 * selectable and the footer shows that day's own totals (jobs done,
 * invoices issued, money collected), computed by computeWeekProgress.
 */
import { getWeekProgress } from "@/lib/dashboard-sections";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { fillTemplate } from "@/lib/revenue";
import { formatMoney } from "@/lib/money";
import { localeMoneyTag } from "@/lib/utils";
import { isoWeekNumber } from "@/lib/week-progress";
import WeekPulseCard, { type WeekPulseDay } from "./WeekPulseCard";

export default async function WeekProgressSection({
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
  const tz = timezone ?? "America/Toronto";
  const progress = await getWeekProgress(businessId, {
    timezone,
    regionCode,
    technicianUserId,
  });
  const heading = t(locale, "dashboard.weekProgressTitle");
  const dateTag = locale === "fr" ? "fr-CA" : "en-CA";
  const moneyLocale = localeMoneyTag(locale);

  const jobsLine = fillTemplate(
    t(
      locale,
      progress.jobsDone === 1
        ? "dashboard.weekProgressJobsOne"
        : "dashboard.weekProgressJobsMany",
    ),
    { count: String(progress.jobsDone) },
  );
  const summary = progress.technician
    ? jobsLine
    : [
        jobsLine,
        fillTemplate(
          t(
            locale,
            progress.invoicesIssued === 1
              ? "dashboard.weekProgressInvoicesOne"
              : "dashboard.weekProgressInvoicesMany",
          ),
          { count: String(progress.invoicesIssued) },
        ),
        fillTemplate(t(locale, "dashboard.weekProgressCollected"), {
          amount: formatMoney(
            progress.collectedCents / 100,
            progress.currency,
            moneyLocale,
          ),
        }),
      ].join(" · ");

  const weekLabel = fillTemplate(t(locale, "dashboard.weekPulseWeek"), {
    week: String(isoWeekNumber(progress.todayKey)),
  });

  const days: WeekPulseDay[] = progress.weekKeys.map((key, i) => {
    const dayTotals = progress.perDay[i];
    const lines: string[] = [];
    if (dayTotals.jobsDone > 0) {
      lines.push(
        fillTemplate(
          t(
            locale,
            dayTotals.jobsDone === 1
              ? "dashboard.weekProgressJobsOne"
              : "dashboard.weekProgressJobsMany",
          ),
          { count: String(dayTotals.jobsDone) },
        ),
      );
    }
    if (!progress.technician && dayTotals.invoicesIssued > 0) {
      lines.push(
        fillTemplate(
          t(
            locale,
            dayTotals.invoicesIssued === 1
              ? "dashboard.weekProgressInvoicesOne"
              : "dashboard.weekProgressInvoicesMany",
          ),
          { count: String(dayTotals.invoicesIssued) },
        ),
      );
    }
    if (!progress.technician && dayTotals.collectedCents > 0) {
      lines.push(
        fillTemplate(t(locale, "dashboard.weekProgressCollected"), {
          amount: formatMoney(
            dayTotals.collectedCents / 100,
            progress.currency,
            moneyLocale,
          ),
        }),
      );
    }
    const date = new Date(`${key}T12:00:00Z`);
    return {
      key,
      letter: new Intl.DateTimeFormat(dateTag, {
        timeZone: tz,
        weekday: "narrow",
      }).format(date),
      dayNum: new Intl.DateTimeFormat(dateTag, {
        timeZone: tz,
        day: "numeric",
      }).format(date),
      fullDate: new Intl.DateTimeFormat(dateTag, {
        timeZone: tz,
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(date),
      active: progress.active[i],
      future: progress.future[i],
      isToday: key === progress.todayKey,
      lines,
    };
  });

  return (
    <WeekPulseCard
      heading={heading}
      summary={summary}
      weekLabel={weekLabel}
      days={days}
      todayKey={progress.todayKey}
      noActivity={t(locale, "dashboard.weekPulseNoActivity")}
      viewDay={t(locale, "dashboard.weekPulseViewDay")}
    />
  );
}
