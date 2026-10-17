import Link from "next/link";
import { AlertTriangle, BellRing, CheckCircle2, Info } from '@/components/icons';
import {
  getAttentionItems,
  daypartGreeting,
  greetingNow,
  type AttentionItem,
  type AttentionSeverity,
} from "@/lib/attention";
import { fillTemplate } from "@/lib/revenue";
import { formatMoney } from "@/lib/money";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { tp } from "@/lib/i18n/plural";
import { localeMoneyTag } from "@/lib/utils";
import { Card } from "@/components/ui";

const SEVERITY_STYLE: Record<AttentionSeverity, { icon: React.ReactNode }> = {
  critical: { icon: <AlertTriangle size={14} className="text-red-600" /> },
  attention: { icon: <BellRing size={14} className="text-amber-600" /> },
  info: { icon: <Info size={14} className="text-sky-600" /> },
  positive: { icon: <CheckCircle2 size={14} className="text-emerald-600" /> },
};

export function AttentionRow({
  item,
  locale,
  moneyLocale,
  currency,
}: {
  item: AttentionItem;
  locale: Locale;
  moneyLocale: "en" | "fr";
  currency?: string | null;
}) {
  const style = SEVERITY_STYLE[item.severity];
  // Part A: lines whose template is a {one, other} plural message render
  // through tp() with the item's count (French treats 0 and 1 as singular).
  const renderLine = (
    which: 'title' | 'detail',
    key: string,
    params: Record<string, string | number>
  ) =>
    item.plural && item.plural.key === which
      ? tp(locale, `attention.${key}`, item.plural.count, params)
      : fillTemplate(t(locale, `attention.${key}`), params);
  const title = renderLine('title', item.titleKey, item.titleParams);
  const detail = renderLine('detail', item.detailKey, item.detailParams);
  // Part A Item 7: One urgency signal per row (the icon), not a dot plus an icon.
  return (
    <Link
      href={item.href}
      className="flex items-start gap-3 px-4 py-3.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors min-h-[56px]"
    >
      <span className="mt-1 shrink-0" aria-hidden>
        {style.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-snug">{title}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          <span className="truncate">{detail}</span>
        </p>
      </div>
      {item.amount != null && item.amount > 0 && (
        <span className="shrink-0 text-sm font-bold text-zinc-900 dark:text-white tabular-nums">
          {formatMoney(item.amount, currency, moneyLocale)}
        </span>
      )}
      <span className="shrink-0 self-center text-[11px] font-semibold text-ink dark:text-zinc-300 underline-offset-2 hover:underline hidden sm:inline">
        {t(locale, `attention.${item.ctaKey}`)}
      </span>
    </Link>
  );
}

/**
 * Dashboard briefing: the top-5 attention items ("here are the 5 things").
 * Async server component - fetches tenant-scoped data, never breaks the
 * dashboard when the DB is having a moment.
 */
export default async function AttentionBriefing({
  businessId,
  currency,
  limit = 5,
  timezone,
}: {
  businessId: string;
  currency?: string | null;
  limit?: number;
  /** Business IANA timezone — drives the time-of-day greeting. */
  timezone?: string | null;
}) {
  const locale = await getLocale();
  const moneyLocale = localeMoneyTag(locale);
  let items: AttentionItem[] = [];
  try {
    items = (await getAttentionItems(businessId, limit, locale)).slice(0, limit);
  } catch (err) {
    console.error("[attention] briefing failed:", err);
    return null;
  }
  if (items.length === 0) return null;

  // Part A: the greeting matches the business's local time.
  const greeting = daypartGreeting(greetingNow(), timezone, locale);

  return (
    <Card className="overflow-hidden dark:bg-coal dark:border-white/10">
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
          {t(locale, "attention.briefingTitle")}
        </h2>
        <Link
          href="/attention"
          className="text-xs font-semibold text-ink dark:text-zinc-300 hover:underline inline-flex items-center gap-1 min-h-[44px] px-2 -mr-2"
        >
          {t(locale, "attention.viewAll")}
        </Link>
      </div>
      <p className="px-5 text-xs text-zinc-500 dark:text-zinc-400 pb-1">
        {fillTemplate(t(locale, "attention.briefingSubtitle"), { greeting })}
      </p>
      <div className="px-2 pb-2 divide-y divide-zinc-100 dark:divide-white/10">
        {items.map((item) => (
          <AttentionRow
            key={item.id}
            item={item}
            locale={locale}
            moneyLocale={moneyLocale}
            currency={currency}
          />
        ))}
      </div>
    </Card>
  );
}
