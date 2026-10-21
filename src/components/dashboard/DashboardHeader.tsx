/**
 * Part C (dashboard rebuild): the dashboard header.
 *
 * The date in the business timezone ("Saturday, October 17") plus one
 * summary sentence built from data by a template, never by AI:
 * "{visits} visits today, {done} done. {amount} ready to invoice."
 * Plural-aware in English and French.
 */
import { getHeaderSummary } from "@/lib/dashboard-sections";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { tp } from "@/lib/i18n/plural";
import { fillTemplate } from "@/lib/revenue";
import { formatMoney } from "@/lib/money";
import { localeMoneyTag } from "@/lib/utils";
import DateTimeText from "@/components/DateTimeText";

export default async function DashboardHeader({
  businessId,
  timezone,
  regionCode,
  showMoney = true,
}: {
  businessId: string;
  timezone?: string | null;
  regionCode?: string | null;
  /**
   * False for viewers whose role lacks SEE_PRICES (technicians): the
   * "ready to invoice" money aggregate is omitted from the summary
   * sentence. Defaults to true so owner/admin/dispatcher are unchanged.
   */
  showMoney?: boolean;
}) {
  const locale: Locale = await getLocale();
  const moneyLocale = localeMoneyTag(locale);
  const summary = await getHeaderSummary(businessId, { timezone, regionCode });

  const visits = tp(locale, "dashboard.visitsToday", summary.visitsToday);
  const done = tp(locale, "dashboard.visitsDone", summary.doneToday);
  const sentence = showMoney
    ? fillTemplate(t(locale, "dashboard.summarySentence"), {
        visits,
        done,
        amount: formatMoney(summary.readyToInvoice, null, moneyLocale),
      })
    : fillTemplate(t(locale, "dashboard.summarySentenceNoMoney"), {
        visits,
        done,
      });

  return (
    <header>
      <h1 className="font-condensed text-[32px] leading-tight font-bold text-asphalt dark:text-hero-ink">
        <DateTimeText date={new Date()} variant="dateline" timezone={timezone ?? undefined} locale={locale} />
      </h1>
      <p className="mt-1 text-[15px] text-ink-2 dark:text-ink-2">{sentence}</p>
    </header>
  );
}
