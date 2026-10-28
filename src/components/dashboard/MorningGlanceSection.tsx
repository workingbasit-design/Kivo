/**
 * Scroll lesson 6 — "Today at a glance" (server only).
 *
 * The first thing on the dashboard: how much work today holds, what is
 * late, and what is first — with one tap into the /today swipe view
 * (lesson 4). The card itself (dismiss + daily reminder) is the client
 * MorningGlanceCard; this section only fetches and localizes.
 */
import { getMorningGlance } from "@/lib/dashboard-sections";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { fillTemplate } from "@/lib/revenue";
import { formatJobTime } from "@/lib/utils";
import MorningGlanceCard from "./MorningGlanceCard";

/** "8:30 a.m." / "8:30" for a stored startAt instant (job-page pattern). */
function instantTime(d: Date, timezone: string, locale: Locale): string {
  const parts = new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hm = `${get("hour")}:${get("minute")}`;
  if (locale === "fr") return hm;
  const ap = get("dayPeriod").toLowerCase().replace("am", "a.m.").replace("pm", "p.m.");
  return `${hm} ${ap}`;
}

export default async function MorningGlanceSection({
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
  const glance = await getMorningGlance(businessId, {
    timezone,
    regionCode,
    technicianUserId,
  });
  const title = t(locale, "dashboard.morningGlanceTitle");

  const jobsLine =
    glance.jobsToday === 0
      ? t(locale, "dashboard.morningGlanceNone")
      : fillTemplate(
          t(
            locale,
            glance.jobsToday === 1
              ? "dashboard.morningGlanceJobsOne"
              : "dashboard.morningGlanceJobsMany",
          ),
          { count: String(glance.jobsToday) },
        );
  const lines = [jobsLine];
  if (glance.first) {
    const time = glance.first.startAt
      ? instantTime(glance.first.startAt, tz, locale)
      : glance.first.time
        ? formatJobTime(glance.first.time, locale)
        : null;
    lines.push(
      time
        ? fillTemplate(t(locale, "dashboard.morningGlanceFirst"), {
            time,
            title: glance.first.title,
          })
        : glance.first.title,
    );
  }
  if (glance.lateCount > 0) {
    lines.push(
      fillTemplate(
        t(
          locale,
          glance.lateCount === 1
            ? "dashboard.morningGlanceLateOne"
            : "dashboard.morningGlanceLateMany",
        ),
        { count: String(glance.lateCount) },
      ),
    );
  }

  const cta =
    glance.jobsToday > 0
      ? { href: "/today", label: t(locale, "dashboard.morningGlanceViewToday") }
      : { href: "/jobs/new", label: t(locale, "dashboard.morningGlanceSchedule") };

  return (
    <MorningGlanceCard
      todayKey={glance.todayKey}
      title={title}
      lines={lines}
      ctaHref={cta.href}
      ctaLabel={cta.label}
      notificationBody={lines.join(" · ")}
      remindOnLabel={t(locale, "dashboard.morningGlanceRemindOn")}
      remindOffLabel={t(locale, "dashboard.morningGlanceRemindOff")}
      remindBlockedLabel={t(locale, "dashboard.morningGlanceRemindBlocked")}
      dismissLabel={t(locale, "dashboard.morningGlanceDismiss")}
    />
  );
}
