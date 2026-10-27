/**
 * Scroll lesson 1 — the "Continue" card (server half).
 *
 * Fetches the single resume candidate for this business, localizes its
 * meta line and action label, and hands a fully formatted display record
 * to the client card. The client card only adds the last-opened record
 * from localStorage — it never formats money, dates, or times itself.
 */
import { getContinueCandidate } from "@/lib/dashboard-sections";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { formatJobTime } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/attention";
import { fillTemplate } from "@/lib/revenue";
import type { ContinueCandidate, ContinueDisplay } from "@/lib/continue-candidate";
import ContinueCard from "./ContinueCard";

/** "8:30 a.m." / "8 h 30" for a stored startAt instant (job-page pattern). */
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
  c: ContinueCandidate,
  locale: Locale,
  timezone: string
): ContinueDisplay {
  let meta: string;
  switch (c.meta.key) {
    case "inProgress":
      meta = t(locale, "dashboard.continueMetaInProgress");
      break;
    case "late":
      meta = t(locale, "dashboard.continueMetaLate");
      break;
    case "todayAt": {
      const time = c.meta.startAtISO
        ? instantTime(new Date(c.meta.startAtISO), timezone, locale)
        : c.meta.time
          ? formatJobTime(c.meta.time, locale)
          : null;
      meta = time
        ? fillTemplate(t(locale, "dashboard.continueMetaTodayAt"), { time })
        : t(locale, "dashboard.continueMetaToday");
      break;
    }
    case "today":
      meta = t(locale, "dashboard.continueMetaToday");
      break;
    case "onDate":
      meta = c.meta.dateISO
        ? formatDisplayDate(new Date(c.meta.dateISO), timezone, locale)
        : "";
      break;
    case "draft":
      meta = t(locale, "dashboard.continueMetaDraft");
      break;
    case "unpaid":
      meta = t(locale, "dashboard.continueMetaUnpaid");
      break;
  }
  const actionLabel =
    c.action === "continue"
      ? t(locale, "dashboard.continueActionContinue")
      : c.action === "send"
        ? t(locale, "dashboard.continueActionSend")
        : c.action === "pay"
          ? t(locale, "dashboard.continueActionPay")
          : t(locale, "dashboard.continueActionView");
  return {
    kind: c.kind,
    id: c.id,
    title: c.title,
    subtitle: c.subtitle,
    meta,
    href: c.href,
    actionLabel,
  };
}

export default async function ContinueSection({
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
  const candidate = await getContinueCandidate(businessId, {
    timezone,
    regionCode,
    technicianUserId,
  });
  return (
    <ContinueCard
      serverDisplay={candidate ? toDisplay(candidate, locale, timezone ?? "America/Toronto") : null}
      serverPriority={candidate ? candidate.priority : null}
      labels={{
        title: t(locale, "dashboard.continueTitle"),
        lastOpened: t(locale, "dashboard.continueLastOpened"),
        viewJob: t(locale, "dashboard.continueActionView"),
        viewQuote: t(locale, "dashboard.continueActionViewQuote"),
        viewInvoice: t(locale, "dashboard.continueActionViewInvoice"),
      }}
    />
  );
}
