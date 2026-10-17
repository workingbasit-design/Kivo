/**
 * Part C (dashboard rebuild): "Needs you".
 *
 * The top 4 attention-engine items with a count badge and "See all".
 * Each item has one action button that opens a draft or a picker -
 * nothing is ever sent from the dashboard.
 */
import Link from "next/link";
import { AlertTriangle, BellRing, Info, CheckCircle2 } from "@/components/icons";
import { getNeedsYou } from "@/lib/dashboard-sections";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { tp } from "@/lib/i18n/plural";
import { fillTemplate } from "@/lib/revenue";
import { formatMoney } from "@/lib/money";
import { localeMoneyTag } from "@/lib/utils";
import type { AttentionItem, AttentionSeverity } from "@/lib/attention";

const SEVERITY_ICON: Record<AttentionSeverity, { icon: React.ReactNode }> = {
  critical: { icon: <AlertTriangle size={18} className="text-signal" /> },
  attention: { icon: <BellRing size={18} className="text-safety-ink dark:text-safety" /> },
  info: { icon: <Info size={18} className="text-steel" /> },
  positive: { icon: <CheckCircle2 size={18} className="text-pine" /> },
};

function NeedsRow({
  item,
  locale,
  moneyLocale,
}: {
  item: AttentionItem;
  locale: Locale;
  moneyLocale: "en" | "fr";
}) {
  const renderLine = (
    which: "title" | "detail",
    key: string,
    params: Record<string, string | number>
  ) =>
    item.plural && item.plural.key === which
      ? tp(locale, `attention.${key}`, item.plural.count, params)
      : fillTemplate(t(locale, `attention.${key}`), params);
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="shrink-0" aria-hidden>
        {SEVERITY_ICON[item.severity].icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug text-asphalt dark:text-white">
          {renderLine("title", item.titleKey, item.titleParams)}
        </p>
        <p className="mt-0.5 text-[13px] text-ink-2 dark:text-zinc-400">
          {renderLine("detail", item.detailKey, item.detailParams)}
          {item.amount != null && item.amount > 0 && (
            <> · <span className="font-semibold tabular-nums">{formatMoney(item.amount, null, moneyLocale)}</span></>
          )}
        </p>
      </div>
      <Link
        href={item.href}
        className="shrink-0 rounded-full border border-line-strong px-4 py-2 text-[13px] font-semibold text-asphalt transition-colors hover:bg-surface-2 active:bg-surface-2 dark:border-white/20 dark:text-white dark:hover:bg-white/5 min-h-[40px] inline-flex items-center"
      >
        {t(locale, `attention.${item.ctaKey}`)}
      </Link>
    </div>
  );
}

export default async function NeedsYou({ businessId }: { businessId: string }) {
  const locale: Locale = await getLocale();
  const moneyLocale = localeMoneyTag(locale);
  const { items, total } = await getNeedsYou(businessId, locale);
  if (total === 0) return null;

  return (
    <section
      aria-label={t(locale, "dashboard.needsYou")}
      className="rounded-[24px] border border-line/70 bg-surface dark:border-white/10 dark:bg-coal"
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-1">
        <h2 className="flex items-center gap-2 text-[17px] font-bold text-asphalt dark:text-white">
          {t(locale, "dashboard.needsYou")}
          <span
            aria-label={fillTemplate(t(locale, "dashboard.needsYouCount"), { count: total })}
            className="inline-flex min-w-[24px] items-center justify-center rounded-full bg-signal/15 px-1.5 py-0.5 text-[13px] font-bold text-signal"
          >
            {total}
          </span>
        </h2>
        <Link
          href="/attention"
          className="inline-flex min-h-[44px] items-center px-2 text-[13px] font-semibold text-asphalt underline underline-offset-2 dark:text-zinc-300"
        >
          {t(locale, "dashboard.seeAll")}
        </Link>
      </div>
      <div className="divide-y divide-line pb-2 dark:divide-white/10">
        {items.map((item) => (
          <NeedsRow key={item.id} item={item} locale={locale} moneyLocale={moneyLocale} />
        ))}
      </div>
    </section>
  );
}
