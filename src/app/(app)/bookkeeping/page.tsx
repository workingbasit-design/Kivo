import { requireAuth } from "@/lib/auth";
import { getBookkeeping } from "@/lib/bookkeeping";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { localeMoneyTag } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { PageHeader, Card, StatCard, EmptyState } from "@/components/ui";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Receipt } from '@/components/icons';
import Link from "next/link";

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
      <PageHeader
        title={t(locale, "bookkeeping.title")}
        subtitle={t(locale, "bookkeeping.subtitle")}
      />

      {!data || !hasActivity ? (
        <Card>
          <EmptyState
            icon={<PiggyBank size={28} className="text-zinc-400" aria-hidden />}
            title={t(locale, "bookkeeping.noData")}
            description={t(locale, "bookkeeping.noDataDesc")}
            action={
              <div className="flex gap-2 flex-wrap justify-center">
                <Link
                  href="/invoices"
                  className="inline-flex items-center px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-bold min-h-[44px]"
                >
                  {t(locale, "bookkeeping.viewInvoices")}
                </Link>
                <Link
                  href="/expenses"
                  className="inline-flex items-center px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-700 min-h-[44px]"
                >
                  {t(locale, "bookkeeping.viewExpenses")}
                </Link>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label={t(locale, "bookkeeping.revenue")}
              value={m(data.totalRevenue)}
              icon={<TrendingUp size={18} aria-hidden />}
              index={0}
            />
            <StatCard
              label={t(locale, "bookkeeping.expenses")}
              value={m(data.totalExpenses)}
              icon={<TrendingDown size={18} aria-hidden />}
              index={1}
            />
            <StatCard
              label={t(locale, "bookkeeping.profit")}
              value={m(data.totalProfit)}
              sub={
                data.marginPct != null
                  ? `${t(locale, "bookkeeping.margin")}: ${data.marginPct}%`
                  : undefined
              }
              icon={<Wallet size={18} aria-hidden />}
              index={2}
            />
            <StatCard
              label={t(locale, "bookkeeping.receivables")}
              value={m(data.receivables)}
              sub={t(locale, "bookkeeping.receivablesDesc")}
              icon={<Receipt size={18} aria-hidden />}
              index={3}
            />
          </div>

          {/* Month by month */}
          <section>
            <h2 className="text-xs font-bold text-zinc-500 mb-2 px-1">
              {t(locale, "bookkeeping.byMonth")}
            </h2>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[300px]">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500 border-b border-zinc-100">
                      <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold">{t(locale, "bookkeeping.month")}</th>
                      <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-right">{t(locale, "bookkeeping.collected")}</th>
                      <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-right">{t(locale, "bookkeeping.spent")}</th>
                      <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-right">{t(locale, "bookkeeping.net")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {data.months.map((mo) => (
                      <tr key={mo.monthKey}>
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3 font-medium text-zinc-800">{mo.label}</td>
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-right tabular-nums text-emerald-700 font-semibold">
                          {m(mo.revenue)}
                        </td>
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-right tabular-nums text-zinc-600">
                          {m(mo.expenses)}
                        </td>
                        <td
                          className={`px-3 py-2.5 sm:px-4 sm:py-3 text-right tabular-nums font-bold ${mo.profit >= 0 ? "text-zinc-900" : "text-red-600"}`}
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
              <h2 className="text-xs font-bold text-zinc-500 mb-2 px-1">
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
                        <span className="font-medium text-zinc-800">
                          {catLabel(locale, c.category)}
                        </span>
                        <span className="font-bold text-zinc-900 tabular-nums">
                          {m(c.total)} <span className="font-normal text-zinc-400">· {pct}%</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-lime-500"
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
