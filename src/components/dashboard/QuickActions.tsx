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

export default async function QuickActions() {
  const locale: Locale = await getLocale();
  const actions = [
    { href: "/jobs/new", icon: <Plus size={21} />, label: t(locale, "dashboard.newJob"), primary: true },
    { href: "/quotes/new", icon: <ReceiptText size={22} />, label: t(locale, "dashboard.quickNewQuote"), primary: false },
    { href: "/invoices/new", icon: <Receipt size={22} />, label: t(locale, "dashboard.quickNewInvoice"), primary: false },
    { href: "/invoices", icon: <HandCoins size={22} />, label: t(locale, "dashboard.recordPayment"), primary: false },
  ];
  return (
    <nav aria-label={t(locale, "dashboard.quickActions")} className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={a.primary ? "ej-quick-card ej-quick-card--primary" : "ej-quick-card"}
        >
          <span aria-hidden className="ej-quick-card-icon">{a.icon}</span>
          <span className="ej-quick-card-label">{a.label}</span>
        </Link>
      ))}
    </nav>
  );
}
