/**
 * Scroll lesson 2 — the "Next best action" card (server only).
 *
 * No client JS: the action is computed server-side by getNextAction and
 * rendered once. The card mirrors the Continue card's shape (heading,
 * title, subtitle + meta, lime action pill) so the two sit as a pair.
 */
import Link from "next/link";
import { ChevronRight, CalendarDays } from "@/components/icons";
import { getNextAction } from "@/lib/dashboard-sections";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { formatJobTime } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/attention";
import { fillTemplate } from "@/lib/revenue";
import type { NextAction } from "@/lib/next-action";

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

function toDisplay(
  action: NextAction,
  locale: Locale,
  timezone: string
): { title: string; subtitle: string; meta: string; actionLabel: string } {
  let meta = "";
  switch (action.meta.key) {
    case "overdue":
      meta = fillTemplate(t(locale, "dashboard.nextActionOverdueBy"), {
        days: String(action.meta.days),
      });
      break;
    case "unpaidFor":
      meta = fillTemplate(t(locale, "dashboard.nextActionUnpaidFor"), {
        days: String(action.meta.days),
      });
      break;
    case "tomorrowAt": {
      const time = action.meta.startAtISO
        ? instantTime(new Date(action.meta.startAtISO), timezone, locale)
        : action.meta.time
          ? formatJobTime(action.meta.time, locale)
          : null;
      meta = time
        ? fillTemplate(t(locale, "dashboard.nextActionTomorrowAt"), { time })
        : t(locale, "dashboard.nextActionTomorrow");
      break;
    }
    case "tomorrow":
      meta = t(locale, "dashboard.nextActionTomorrow");
      break;
    case "onDate":
      meta = formatDisplayDate(new Date(action.meta.dateISO), timezone, locale);
      break;
    case "none":
      meta = "";
      break;
  }
  switch (action.kind) {
    case "follow-up":
      return {
        title: action.title,
        subtitle: action.customerName ?? "",
        meta,
        actionLabel: t(locale, "dashboard.nextActionFollowUp"),
      };
    case "confirm":
      return {
        title: action.title,
        subtitle: action.customerName ?? "",
        meta,
        actionLabel: t(locale, "dashboard.nextActionConfirm"),
      };
    case "review":
      return {
        title: action.title,
        subtitle: action.customerName ?? "",
        meta,
        actionLabel: t(locale, "dashboard.nextActionReview"),
      };
    case "fill-schedule":
      return {
        title: t(locale, "dashboard.nextActionEmptyTitle"),
        subtitle: t(locale, "dashboard.nextActionEmptyHint"),
        meta,
        actionLabel: t(locale, "dashboard.nextActionSchedule"),
      };
  }
}

export default async function NextActionSection({
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
  const locale = await getLocale();
  const action = await getNextAction(businessId, {
    timezone,
    regionCode,
    technicianUserId,
  });
  if (!action) return null;
  const display = toDisplay(action, locale, timezone ?? "America/Toronto");
  const heading = t(locale, "dashboard.nextActionTitle");

  return (
    <section
      aria-label={heading}
      className="ej-next-card"
    >
      <div className="ej-next-card-row">
        <span className="ej-next-card-icon" aria-hidden="true">
          <CalendarDays size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="ej-card-eyebrow">
            {heading}
          </p>
          <h3 className="truncate">
            {display.title}
          </h3>
          <p className="ej-next-card-meta truncate">
            {display.subtitle}
            {display.meta ? ` · ${display.meta}` : ""}
          </p>
        </div>
        <Link
          href={action.href}
          className="ej-lime-pill shrink-0"
        >
          {display.actionLabel} <ChevronRight size={16} />
        </Link>
      </div>
    </section>
  );
}
