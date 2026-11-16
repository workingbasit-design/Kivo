/**
 * Part C (dashboard rebuild): the four quick actions.
 *
 * New job is the ONE hi-vis primary (kit Button). "Record payment" opens
 * the invoices list, where payments are recorded on the invoice detail
 * page (there is no standalone payment form in the app).
 */
import Link from "next/link";
import { Plus, ReceiptText, Receipt, HandCoins } from "@/components/icons";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { Button } from "@/components/kit/Button";
import { cn } from "@/lib/utils";

const TILE =
  "ej-quick-action group flex min-h-[112px] flex-col items-start justify-between gap-3 rounded-[20px] border border-line bg-surface p-4 text-left text-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-line hover:shadow-sm active:scale-[0.98]";

export default async function QuickActions() {
  const locale: Locale = await getLocale();
  const actions = [
    { href: "/quotes/new", icon: <ReceiptText size={22} />, label: t(locale, "dashboard.quickNewQuote") },
    { href: "/invoices/new", icon: <Receipt size={22} />, label: t(locale, "dashboard.quickNewInvoice") },
    { href: "/invoices", icon: <HandCoins size={22} />, label: t(locale, "dashboard.recordPayment") },
  ];
  return (
    <nav aria-label={t(locale, "dashboard.quickActions")} className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3">
      <Button href="/jobs/new" className={cn("ej-quick-action ej-quick-action--primary !flex !min-h-[112px] !flex-col !items-start !justify-between !gap-3 !rounded-[20px] !p-4 whitespace-normal text-left")}>
        <span className="ej-quick-action-icon" aria-hidden="true"><Plus size={21} /></span>
        <span className="text-left text-[13px] font-bold leading-snug">{t(locale, "dashboard.newJob")}</span>
      </Button>
      {actions.map((a) => (
        <Link key={a.href + a.label} href={a.href} className={cn(TILE)}>
          <span aria-hidden className="ej-quick-action-icon text-ink-2 group-hover:text-ink">{a.icon}</span>
          <span className="text-[13px] font-semibold leading-snug">{a.label}</span>
        </Link>
      ))}
    </nav>
  );
}
