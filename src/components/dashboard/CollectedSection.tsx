/**
 * Part C (dashboard rebuild): server wrapper for the Collected card.
 * Fetches the week/month data, then hands it to the client toggle card.
 */
import { getCollected } from "@/lib/dashboard-sections";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import CollectedCard from "./CollectedCard";

export default async function CollectedSection({
  businessId,
  timezone,
  regionCode,
}: {
  businessId: string;
  timezone?: string | null;
  regionCode?: string | null;
}) {
  const locale: Locale = await getLocale();
  const data = await getCollected(businessId, { timezone, regionCode });

  return (
    <CollectedCard
      data={data}
      locale={locale}
      labels={{
        collected: t(locale, "dashboard.collected"),
        thisWeek: t(locale, "dashboard.thisWeek"),
        thisMonth: t(locale, "dashboard.thisMonth"),
        trendUpTemplate: t(locale, "dashboard.trendUp"),
        trendDownTemplate: t(locale, "dashboard.trendDown"),
        periodWeek: t(locale, "dashboard.periodWeek"),
        periodMonth: t(locale, "dashboard.periodMonth"),
        invoiced: t(locale, "dashboard.invoiced"),
        jobsDone: t(locale, "dashboard.jobsDone"),
        jobsDoneOfTemplate: t(locale, "dashboard.jobsDoneOf"),
        chartSummaryTemplate: t(locale, "dashboard.collectedSummary"),
        barLabelTemplate: t(locale, "dashboard.collectedBar"),
        showNumbers: t(locale, "dashboard.showNumbers"),
        hideNumbers: t(locale, "dashboard.hideNumbers"),
        periodLabel: t(locale, "dashboard.period"),
      }}
    />
  );
}
