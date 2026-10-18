import { requireAuth } from "@/lib/auth";
import { getBookkeeping } from "@/lib/bookkeeping";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { localeMoneyTag } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { Card } from '@/components/kit';
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Receipt } from '@/components/icons';
import Link from "next/link";
import { PageTitle } from '../_components/PageTitle';
import { Button, EmptyState, SummaryCard } from '@/components/kit';

function catLabel(locale: Locale, category: string): string {
  const key = `bookkeeping.cat${category}` as never;
  const v = t(locale, key);
  return typeof v === 'string' && !v.includes('bookkeeping.') ? v : category;
}

export default async function BookkeepingPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const moneyLocale = localeMoneyTag(locale);

  let data = null;
  try {
    data = await getBookkeeping(businessId, 6, locale);
  } catch (err) {
    console.error("[bookkeeping] page failed:", err);
  }

  const m = (n: number) => formatMoney(n, "CAD", moneyLocale);
  const hasActivity =
    data && (data.totalRevenue > 0 || data.totalExpenses > 0 || data.receivables > 0);

  return (
    <div className="space-y-6">
      <PageTitle
        title={t(locale, "bookkeeping.title")}
        summary={t(locale, "bookkeeping.subtitle")}
      />

      {!data || !hasActivity ? (
        <Card>
          <EmptyState
            icon={PiggyBank}
            title={t(locale, "bookkeeping.noData")}
            text={t(locale, "bookkeeping.noDataDesc")}
          />
          <div className="flex gap-2 flex-wrap justify-center pb-10 -mt-6">
            <Button href="/invoices" variant="primary" sm>
              {t(locale, "bookkeeping.viewInvoices")}
            </Button>
            <Button href="/expenses" variant="secondary" sm>
              {t(locale, "bookkeeping.viewExpenses")}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Headline numbers */}
          <SummaryCard
            stats={[
              { label: t(locale, "bookkeeping.revenue"), value: m(data.totalRevenue) },
              { label: t(locale, "bookkeeping.expenses"), value: m(data.totalExpenses) },
              {
                label: t(locale, "bookkeeping.profit"),
                value: m(data.totalProfit),
                sub:
                  data.marginPct != null
                    ? `${t(locale, "bookkeeping.margin")}: ${data.marginPct}%`
                    : undefined,
              },
              {
                label: t(locale, "bookkeeping.receivables"),
                value: m(data.receivables),
                sub: t(locale, "bookkeeping.receivablesDesc"),
              },
            ]}
          />

          {/* Month by month */}
          <section>
            <h2 className="text-xs font-bold text-ink-2 mb-2 px-1">
              {t(locale, "bookkeeping.byMonth")}
            </h2>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[300px]">
                  <thead>
                    <tr className="text-left text-xs text-ink-2 border-b border-line">
                      <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold">{t(locale, "bookkeeping.month")}</th>
                      <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-right">{t(locale, "bookkeeping.collected")}</th>
                      <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-right">{t(locale, "bookkeeping.spent")}</th>
                      <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-right">{t(locale, "bookkeeping.net")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.months.map((mo) => (
                      <tr key={mo.monthKey}>
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3 font-medium text-ink">{mo.label}</td>
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-right tabular-nums text-ok font-semibold">
                          {m(mo.revenue)}
                        </td>
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-right tabular-nums text-ink-2">
                          {m(mo.expenses)}
                        </td>
                        <td
                          className={`px-3 py-2.5 sm:px-4 sm:py-3 text-right tabular-nums font-bold ${mo.profit >= 0 ? "text-ink" : "text-danger"}`}
                        >
                          {m(mo.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          {/* Spending by category */}
          {data.byCategory.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-ink-2 mb-2 px-1">
                {t(locale, "bookkeeping.byCategory")}
              </h2>
              <Card className="p-4 space-y-3">
                {data.byCategory.map((c) => {
                  const pct =
                    data.totalExpenses > 0
                      ? Math.round((c.total / data.totalExpenses) * 100)
                      : 0;
                  return (
                    <div key={c.category}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-ink">
                          {catLabel(locale, c.category)}
                        </span>
                        <span className="font-bold text-ink tabular-nums">
                          {m(c.total)} <span className="font-normal text-ink-2">· {pct}%</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-hivis"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}
