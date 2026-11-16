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
 */
import Link from "next/link";
import { getWeekProgress } from "@/lib/dashboard-sections";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { fillTemplate } from "@/lib/revenue";
import { formatMoney } from "@/lib/money";
import { localeMoneyTag } from "@/lib/utils";

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
            localeMoneyTag(locale),
          ),
        }),
      ].join(" · ");

  return (
    <section
      aria-label={heading}
      className="ej-week-card"
    >
      <h2>
        {heading}
      </h2>
      <p className="ej-week-summary">
        {summary}
      </p>
      <div className="ej-week-days">
        {progress.weekKeys.map((key, i) => {
          const letter = new Intl.DateTimeFormat(dateTag, {
            timeZone: tz,
            weekday: "narrow",
          }).format(new Date(`${key}T12:00:00Z`));
          const fullDate = new Intl.DateTimeFormat(dateTag, {
            timeZone: tz,
            weekday: "long",
            month: "long",
            day: "numeric",
          }).format(new Date(`${key}T12:00:00Z`));
          const filled = progress.active[i];
          const future = progress.future[i];
          const isToday = key === progress.todayKey;
          return (
            <Link
              key={key}
              href={`/schedule?day=${key}`}
              aria-label={fullDate}
              className={[
                "ej-week-day",
                filled ? "ej-week-day--active" : "",
                future ? "ej-week-day--future" : "",
                isToday ? "ej-week-day--today" : "",
              ].join(" ")}
            >
              <span
                className="ej-week-day-dot"
                aria-hidden="true"
              />
              <span className="ej-week-day-label" aria-hidden="true">
                {letter}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
