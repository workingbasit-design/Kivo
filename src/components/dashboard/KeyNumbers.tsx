/**
 * Part C (dashboard rebuild): the Key numbers 2x2.
 *
 * Each tile opens its filtered list, and its number equals that list:
 * owed = the unpaid-invoices total (overdue slice in red, with an aging
 * bar), ready to invoice = completed jobs with no invoice, quotes waiting
 * = SENT quotes (expiring-soon slice), new leads = NEW leads with the
 * average first reply this week and the oldest still waiting.
 */
import Link from "next/link";
import { ReceiptText, CheckCircle2, FileText, UserPlus, Clock } from "@/components/icons";
import { getKeyNumbers } from "@/lib/dashboard-sections";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { tp } from "@/lib/i18n/plural";
import { fillTemplate } from "@/lib/revenue";
import { formatMoney } from "@/lib/money";
import { localeMoneyTag } from "@/lib/utils";
import { cn } from "@/lib/utils";

const TILE =
  "rounded-[24px] border border-zinc-200/70 bg-white p-4 flex flex-col gap-1 min-h-[148px] transition-transform active:scale-[0.98] dark:border-white/10 dark:bg-coal";

function TileHead({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-600 dark:text-zinc-400">
      <span aria-hidden className="text-zinc-500 dark:text-zinc-400">{icon}</span>
      {label}
    </p>
  );
}

/** Segmented aging bar: current / 1-30 / 31-60 / 60+ days. */
function AgingBar({ aging, total }: { aging: { current: number; d1_30: number; d31_60: number; over60: number }; total: number }) {
  const segs = [
    { v: aging.current, cls: "bg-steel" },
    { v: aging.d1_30, cls: "bg-safety" },
    { v: aging.d31_60, cls: "bg-safety-ink" },
    { v: aging.over60, cls: "bg-signal" },
  ];
  if (total <= 0) return null;
  return (
    <div className="mt-auto flex h-2 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden>
      {segs.map(
        (s, i) =>
          s.v > 0 && (
            <span key={i} className={cn("h-full rounded-full", s.cls)} style={{ width: `${(s.v / total) * 100}%` }} />
          )
      )}
    </div>
  );
}

/** Quote expiry bar: one segment per quote (up to 8), orange when expiring. */
function QuoteBar({ count, expiringSoon }: { count: number; expiringSoon: number }) {
  if (count <= 0) return null;
  const n = Math.min(count, 8);
  const orange = Math.min(expiringSoon, n);
  return (
    <div className="mt-auto flex h-2 w-full gap-1" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className={cn("h-full flex-1 rounded-full", i < orange ? "bg-safety" : "bg-zinc-200 dark:bg-white/15")} />
      ))}
    </div>
  );
}

function formatDuration(min: number, locale: Locale): string {
  if (min < 60) return fillTemplate(t(locale, "dashboard.durationMin"), { n: min });
  const h = Math.floor(min / 60);
  const m = min % 60;
  return fillTemplate(t(locale, "dashboard.durationHour"), { h, m: String(m).padStart(2, "0") });
}

export default async function KeyNumbers({
  businessId,
  timezone,
  regionCode,
}: {
  businessId: string;
  timezone?: string | null;
  regionCode?: string | null;
}) {
  const locale: Locale = await getLocale();
  const moneyLocale = localeMoneyTag(locale);
  const k = await getKeyNumbers(businessId, { timezone, regionCode });

  return (
    <div className="grid grid-cols-2 gap-2.5" role="group" aria-label={t(locale, "dashboard.keyNumbers")}>
      {/* Owed to you */}
      <Link href="/invoices" className={TILE} aria-label={t(locale, "dashboard.owedToYou")}>
        <TileHead icon={<ReceiptText size={15} />} label={t(locale, "dashboard.owedToYou")} />
        <p className="ej-figure text-[30px] font-bold leading-none text-asphalt tabular-nums dark:text-white">
          {formatMoney(k.owed.total, null, moneyLocale)}
        </p>
        {k.owed.overdue > 0 ? (
          <p className="text-[13px] font-semibold text-signal">
            {fillTemplate(t(locale, "dashboard.overdueIs"), {
              amount: formatMoney(k.owed.overdue, null, moneyLocale),
            })}
          </p>
        ) : (
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{t(locale, "dashboard.nothingOverdue")}</p>
        )}
        <AgingBar aging={k.owed.aging} total={k.owed.total} />
      </Link>

      {/* Ready to invoice */}
      <Link href="/invoices/new" className={TILE} aria-label={t(locale, "dashboard.readyToInvoice")}>
        <TileHead icon={<CheckCircle2 size={15} />} label={t(locale, "dashboard.readyToInvoice")} />
        <p className="ej-figure text-[30px] font-bold leading-none text-asphalt tabular-nums dark:text-white">
          {formatMoney(k.readyToInvoice.amount, null, moneyLocale)}
        </p>
        <p className="text-[13px] text-zinc-600 dark:text-zinc-400">
          {tp(locale, "dashboard.finishedJobs", k.readyToInvoice.jobs)}
        </p>
        {k.readyToInvoice.customerInitials.length > 0 && (
          <p className="mt-auto flex gap-1" aria-hidden>
            {k.readyToInvoice.customerInitials.map((init) => (
              <span
                key={init}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
              >
                {init}
              </span>
            ))}
          </p>
        )}
      </Link>

      {/* Quotes waiting */}
      <Link href="/quotes" className={TILE} aria-label={t(locale, "dashboard.quotesWaiting")}>
        <TileHead icon={<FileText size={15} />} label={t(locale, "dashboard.quotesWaiting")} />
        <p className="ej-figure text-[30px] font-bold leading-none text-asphalt tabular-nums dark:text-white">
          {formatMoney(k.quotesWaiting.amount, null, moneyLocale)}
        </p>
        <p className={cn("text-[13px] font-semibold", k.quotesWaiting.expiringSoon > 0 ? "text-safety-ink dark:text-safety" : "text-zinc-600 dark:text-zinc-400")}>
          {tp(locale, "dashboard.quotesWaitingDetail", k.quotesWaiting.count, {
            expiring: k.quotesWaiting.expiringSoon,
          })}
        </p>
        <QuoteBar count={k.quotesWaiting.count} expiringSoon={k.quotesWaiting.expiringSoon} />
      </Link>

      {/* New leads */}
      <Link href="/leads" className={TILE} aria-label={t(locale, "dashboard.newLeads")}>
        <TileHead icon={<UserPlus size={15} />} label={t(locale, "dashboard.newLeads")} />
        <p className="ej-figure text-[30px] font-bold leading-none text-asphalt tabular-nums dark:text-white">
          {k.newLeads.waiting}
        </p>
        <p className="text-[13px] text-zinc-600 dark:text-zinc-400">
          {k.newLeads.avgFirstReplyMin != null
            ? fillTemplate(t(locale, "dashboard.avgFirstReply"), {
                duration: formatDuration(k.newLeads.avgFirstReplyMin, locale),
              })
            : t(locale, "dashboard.noRepliesYet")}
        </p>
        {k.newLeads.oldestWaitingMin != null && (
          <p className="mt-auto flex items-center gap-1 text-[13px] font-semibold text-safety-ink dark:text-safety">
            <Clock size={13} aria-hidden />
            {fillTemplate(t(locale, "dashboard.oldestWaiting"), {
              duration: formatDuration(k.newLeads.oldestWaitingMin, locale),
            })}
          </p>
        )}
      </Link>
    </div>
  );
}
