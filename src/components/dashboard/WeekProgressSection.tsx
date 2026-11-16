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
      className="ej-dashboard-card ej-dashboard-card--week rounded-[24px] p-5"
    >
      <p className="ej-dashboard-card-label">
        {heading}
      </p>
      <p className="mt-1.5 text-[15px] font-semibold leading-relaxed text-ink">
        {summary}
      </p>
      <div className="ej-week-days mt-5 grid grid-cols-7 gap-2" aria-hidden="true">
        {progress.weekKeys.map((key, i) => {
          const letter = new Intl.DateTimeFormat(dateTag, {
            timeZone: tz,
            weekday: "narrow",
          }).format(new Date(`${key}T12:00:00Z`));
          const filled = progress.active[i];
          const future = progress.future[i];
          const isToday = key === progress.todayKey;
          return (
            <div
              key={key}
              className={[
                "flex min-w-0 flex-col items-center gap-2 rounded-xl px-1.5 py-2",
                isToday ? "bg-surface-2 ring-1 ring-line-strong" : "bg-transparent",
                future ? "opacity-50" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "block h-3.5 w-3.5 rounded-full",
                  filled
                    ? "bg-hivis shadow-[0_0_0_3px_rgba(198,244,50,0.16)]"
                    : "border-2 border-line bg-transparent",
                  isToday ? "ring-2 ring-hivis ring-offset-2 ring-offset-surface-2" : "",
                ].join(" ")}
              />
              <span className={[
                "text-[11px] font-bold leading-none",
                isToday ? "text-ink" : "text-ink-2",
              ].join(" ")}>
                {letter}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
