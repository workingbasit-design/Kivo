import Link from "next/link";
import { AlertTriangle, ArrowRight, BellRing, CheckCircle2, Info } from "lucide-react";
import { getAttentionItems, type AttentionItem, type AttentionSeverity } from "@/lib/attention";
import { fillTemplate } from "@/lib/revenue";
import { formatMoney } from "@/lib/money";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { localeMoneyTag } from "@/lib/utils";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

const SEVERITY_STYLE: Record<AttentionSeverity, { dot: string; icon: React.ReactNode }> = {
  critical: { dot: "bg-red-500", icon: <AlertTriangle size={14} className="text-red-600" /> },
  attention: { dot: "bg-amber-500", icon: <BellRing size={14} className="text-amber-600" /> },
  info: { dot: "bg-sky-500", icon: <Info size={14} className="text-sky-600" /> },
  positive: { dot: "bg-emerald-500", icon: <CheckCircle2 size={14} className="text-emerald-600" /> },
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
  const title = fillTemplate(t(locale, `attention.${item.titleKey}`), item.titleParams);
  const detail = fillTemplate(t(locale, `attention.${item.detailKey}`), item.detailParams);
  return (
    <Link
      href={item.href}
      className="flex items-start gap-3 px-4 py-3.5 rounded-xl hover:bg-zinc-50 transition-colors min-h-[56px]"
    >
      <span className={cn("mt-1.5 w-2 h-2 rounded-full shrink-0", style.dot)} aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 leading-snug">{title}</p>
        <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5">
          {style.icon}
          <span className="truncate">{detail}</span>
        </p>
      </div>
      {item.amount != null && item.amount > 0 && (
        <span className="shrink-0 text-sm font-bold text-zinc-900 tabular-nums">
          {formatMoney(item.amount, currency, moneyLocale)}
        </span>
      )}
      <span className="shrink-0 self-center text-[11px] font-semibold text-ink underline-offset-2 hover:underline hidden sm:inline">
        {t(locale, `attention.${item.ctaKey}`)}
      </span>
    </Link>
  );
}

/**
 * Dashboard briefing: the top-5 attention items ("here are the 5 things").
 * Async server component — fetches tenant-scoped data, never breaks the
 * dashboard when the DB is having a moment.
 */
export default async function AttentionBriefing({
  businessId,
  currency,
  limit = 5,
}: {
  businessId: string;
  currency?: string | null;
  limit?: number;
}) {
  const locale = await getLocale();
  const moneyLocale = localeMoneyTag(locale);
  let items: AttentionItem[] = [];
  try {
    items = (await getAttentionItems(businessId, limit)).slice(0, limit);
  } catch (err) {
    console.error("[attention] briefing failed:", err);
    return null;
  }
  if (items.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <h2 className="text-sm font-bold text-zinc-900">
          {t(locale, "attention.briefingTitle")}
        </h2>
        <Link
          href="/attention"
          className="text-xs font-semibold text-ink hover:underline inline-flex items-center gap-1 min-h-[44px] px-2 -mr-2"
        >
          {t(locale, "attention.viewAll")} <ArrowRight size={13} />
        </Link>
      </div>
      <p className="px-5 text-xs text-zinc-500 pb-1">
        {t(locale, "attention.briefingSubtitle")}
      </p>
      <div className="px-2 pb-2 divide-y divide-zinc-100">
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
