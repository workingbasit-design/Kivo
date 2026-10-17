/**
 * Part C (dashboard rebuild): the four quick actions.
 *
 * New job is the ONE hi-vis primary. "Record payment" opens the invoices
 * list, where payments are recorded on the invoice detail page (there is
 * no standalone payment form in the app).
 */
import Link from "next/link";
import { Plus, ReceiptText, Receipt, HandCoins } from "@/components/icons";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { hivisBtnClass } from "@/components/ui";
import { cn } from "@/lib/utils";

const TILE =
  "flex flex-col items-start justify-between gap-2 rounded-[20px] border border-zinc-200/70 bg-white p-4 min-h-[104px] text-left transition-transform active:scale-[0.98] dark:bg-coal dark:border-white/10";

export default async function QuickActions() {
  const locale: Locale = await getLocale();
  const actions = [
    { href: "/quotes/new", icon: <ReceiptText size={22} />, label: t(locale, "dashboard.quickNewQuote") },
    { href: "/invoices/new", icon: <Receipt size={22} />, label: t(locale, "dashboard.quickNewInvoice") },
    { href: "/invoices", icon: <HandCoins size={22} />, label: t(locale, "dashboard.recordPayment") },
  ];
  return (
    <nav aria-label={t(locale, "dashboard.quickActions")} className="grid grid-cols-4 gap-2.5">
      <Link href="/jobs/new" className={cn(hivisBtnClass, "flex-col !items-start !justify-between gap-2 !rounded-[20px] !p-4 !min-h-[104px]")}>
        <Plus size={22} aria-hidden />
        <span className="text-left leading-tight">{t(locale, "dashboard.newJob")}</span>
      </Link>
      {actions.map((a) => (
        <Link key={a.href + a.label} href={a.href} className={cn(TILE, "text-asphalt dark:text-white")}>
          <span aria-hidden className="text-asphalt dark:text-zinc-200">{a.icon}</span>
          <span className="text-[13px] font-semibold leading-tight">{a.label}</span>
        </Link>
      ))}
    </nav>
  );
}
