import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAttentionItems, type AttentionItem } from "@/lib/attention";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import { localeMoneyTag } from "@/lib/utils";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { AttentionRow } from "@/components/AttentionBriefing";
import { CheckCircle2 } from "lucide-react";

export default async function AttentionPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const moneyLocale = localeMoneyTag(locale);
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { currency: true },
  });

  let items: AttentionItem[] = [];
  try {
    items = await getAttentionItems(businessId);
  } catch (err) {
    console.error("[attention] page failed:", err);
  }

  const groups = [
    { severity: "critical", items: items.filter((i) => i.severity === "critical") },
    { severity: "attention", items: items.filter((i) => i.severity === "attention") },
    { severity: "info", items: items.filter((i) => i.severity === "info") },
    { severity: "positive", items: items.filter((i) => i.severity === "positive") },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "attention.title")}
        subtitle={
          items.length > 0
            ? t(locale, "attention.subtitle").replace("{count}", String(items.length))
            : undefined
        }
      />
      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CheckCircle2 size={28} className="text-emerald-500" aria-label="All clear" />}
            title={t(locale, "attention.emptyTitle")}
            description={t(locale, "attention.emptyDesc")}
          />
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.severity}>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 px-1">
              {t(locale, `attention.severity.${g.severity}`)} · {g.items.length}
            </h2>
            <Card className="px-2 py-2 divide-y divide-zinc-100">
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
