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
      className="rounded-[24px] border border-line/70 bg-surface p-5 dark:border-hero-ink/10 dark:bg-coal"
    >
      <p className="text-[13px] font-semibold text-ink-2 dark:text-ink-2">
        {heading}
      </p>
      <p className="mt-1 text-[15px] font-bold leading-snug text-asphalt dark:text-hero-ink">
        {summary}
      </p>
      <div className="mt-4 flex justify-between" aria-hidden="true">
        {progress.weekKeys.map((key, i) => {
          const letter = new Intl.DateTimeFormat(dateTag, {
            timeZone: tz,
            weekday: "narrow",
          }).format(new Date(`${key}T12:00:00Z`));
          const filled = progress.active[i];
          const future = progress.future[i];
          const isToday = key === progress.todayKey;
          return (
            <div key={key} className="flex flex-col items-center gap-1.5">
              <span
                className={[
                  "block h-3 w-3 rounded-full",
                  filled ? "bg-hivis" : "border border-line bg-transparent",
                  future ? "opacity-40" : "",
                  isToday ? "ring-2 ring-line" : "",
                ].join(" ")}
              />
              <span className="text-[10px] font-bold text-ink-2 dark:text-ink-2">
                {letter}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
