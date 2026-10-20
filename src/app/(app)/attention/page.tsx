import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAttentionItems, type AttentionItem, type AttentionCategory } from "@/lib/attention";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import { tp } from "@/lib/i18n/plural";
import { localeMoneyTag } from "@/lib/utils";
import { Card } from '@/components/kit';
import { AttentionRow } from "@/components/AttentionBriefing";
import { CheckCircle2 } from '@/components/icons';
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PageTitle } from '../_components/PageTitle';
import { EmptyState } from '@/components/kit';

const CATEGORIES: AttentionCategory[] = ['jobs', 'money', 'leads', 'quotes', 'inventory', 'schedule'];

export default async function AttentionPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const moneyLocale = localeMoneyTag(locale);
  const { cat } = await searchParams;
  const activeCat = CATEGORIES.includes(cat as AttentionCategory) ? (cat as AttentionCategory) : null;
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { currency: true },
  });

  let allItems: AttentionItem[] = [];
  try {
    allItems = await getAttentionItems(businessId);
  } catch (err) {
    console.error("[attention] page failed:", err);
  }

  const items = (activeCat ? allItems.filter((i) => i.category === activeCat) : allItems);

  const catCounts = CATEGORIES.map((c) => ({
    cat: c,
    count: allItems.filter((i) => i.category === c).length,
  })).filter((c) => c.count > 0);

  const groups = [
    { severity: "critical", items: items.filter((i) => i.severity === "critical") },
    { severity: "attention", items: items.filter((i) => i.severity === "attention") },
    { severity: "info", items: items.filter((i) => i.severity === "info") },
    { severity: "positive", items: items.filter((i) => i.severity === "positive") },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <PageTitle
        title={t(locale, "attention.title")}
        summary={
          allItems.length > 0
            ? tp(locale, "attention.subtitle", allItems.length)
            : undefined
        }
      />
      {catCounts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label={t(locale, "attention.title")}>
          <Link
            href="/attention"
            role="tab"
            aria-selected={!activeCat}
            className={cn(
              "shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-colors min-h-[44px] flex items-center",
              !activeCat
                ? "bg-asphalt text-hero-ink border-line-strong"
                : "bg-surface text-ink border-line hover:border-line-strong"
            )}
          >
            {t(locale, "attention.filterAll")} · {allItems.length}
          </Link>
          {catCounts.map(({ cat: c, count }) => (
            <Link
              key={c}
              href={`/attention?cat=${c}`}
              role="tab"
              aria-selected={activeCat === c}
              className={cn(
                "shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-colors min-h-[44px] flex items-center",
                activeCat === c
                  ? "bg-asphalt text-hero-ink border-line-strong"
                  : "bg-surface text-ink border-line hover:border-line-strong"
              )}
            >
              {t(locale, `attention.category.${c}`)} · {count}
            </Link>
          ))}
        </div>
      )}
      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CheckCircle2 />}
            title={t(locale, "attention.emptyTitle")}
            text={t(locale, "attention.emptyDesc")}
          />
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.severity}>
            <h2 className="text-xs font-bold text-ink-2 mb-2 px-1">
              {t(locale, `attention.severity.${g.severity}`)} · {g.items.length}
            </h2>
            <Card className="px-2 py-2 divide-y divide-line">
              {g.items.map((item) => (
                <AttentionRow
                  key={item.id}
                  item={item}
                  locale={locale}
                  moneyLocale={moneyLocale}
                  currency={business?.currency}
                />
              ))}
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
