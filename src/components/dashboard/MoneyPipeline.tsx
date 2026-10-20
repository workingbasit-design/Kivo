/**
 * Part C (dashboard rebuild): "Where your money is".
 *
 * The pipeline stages, each with a count and an amount. "Approved, not
 * scheduled" (NEW jobs with no date) and "done, not invoiced" are the
 * leaks: orange dot, orange hint and a fix button. Stages with nothing in
 * them are hidden and named in one muted line instead. Amounts show whole
 * dollars. The total is the money in progress right now.
 */
import Link from "next/link";
import { getMoneyPipeline, type PipelineStage } from "@/lib/dashboard-sections";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { tp } from "@/lib/i18n/plural";
import { cn } from "@/lib/utils";

/** Whole dollars: "$5,300" (en) / "5 300 $" (fr), never cents. */
function formatWholeCAD(amount: number, locale: Locale): string {
  const n = Math.round(amount);
  if (locale === "fr") {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(n);
  }
  return (
    "$" +
    n.toLocaleString("en-CA", {
      maximumFractionDigits: 0,
    })
  );
}

const STAGE_SHORT_NAMES: Record<PipelineStage["key"], string> = {
  leads: "dashboard.pipelineStageLeads",
  quotes: "dashboard.pipelineStageQuotes",
  approved: "dashboard.pipelineStageApprovals",
  scheduled: "dashboard.pipelineStageScheduled",
  done: "dashboard.pipelineStageDone",
  invoiced: "dashboard.pipelineStageUnpaid",
};

/** "a, b, c or d" / "a, b, c ou d" for the muted empty-stages line. */
function joinNames(names: string[], locale: Locale): string {
  if (names.length <= 1) return names.join("");
  const conj = locale === "fr" ? " ou " : " or ";
  return names.slice(0, -1).join(", ") + conj + names[names.length - 1];
}

function StageHint({ stage, locale }: { stage: PipelineStage; locale: Locale }) {
  switch (stage.key) {
    case "leads":
      return <>{t(locale, "dashboard.stageNewLeadsHint")}</>;
    case "quotes":
      return <>{tp(locale, "dashboard.stageQuotesHint", stage.count)}</>;
    case "approved": {
      const text = tp(locale, "dashboard.stageApprovedHint", stage.count);
      return stage.count > 0 ? (
        <span className="font-semibold text-safety-ink dark:text-safety">{text}</span>
      ) : (
        <>{text}</>
      );
    }
    case "scheduled":
      return <>{tp(locale, "dashboard.stageScheduledHint", stage.count)}</>;
    case "done":
      return (
        <span className="font-semibold text-safety-ink dark:text-safety">
          {tp(locale, "dashboard.stageDoneHint", stage.count)}
        </span>
      );
    case "invoiced": {
      return stage.overdue && stage.overdue > 0 ? (
        <>
          {tp(locale, "dashboard.stageInvoicedHint", stage.count, {
            amount: formatWholeCAD(stage.overdue, locale),
          })}
        </>
      ) : (
        <>{tp(locale, "dashboard.stageInvoicedHintClean", stage.count)}</>
      );
    }
  }
}

function FixButton({ stage, locale }: { stage: PipelineStage; locale: Locale }) {
  if (stage.key === "approved" && stage.count > 0) {
    return (
      <Link
        href="/schedule"
        className="mt-2 inline-flex min-h-[44px] items-center rounded-full border border-safety px-4 py-2 text-[13px] font-bold text-safety-ink dark:text-safety"
      >
        {tp(locale, "dashboard.scheduleJobs", stage.count)}
      </Link>
    );
  }
  if (stage.key === "done" && stage.count > 0) {
    return (
      <Link
        href="/invoices/new"
        className="mt-2 inline-flex min-h-[44px] items-center rounded-full border border-safety px-4 py-2 text-[13px] font-bold text-safety-ink dark:text-safety"
      >
        {tp(locale, "dashboard.invoiceJobs", stage.count)}
      </Link>
    );
  }
  return null;
}

const STAGE_TITLES: Record<PipelineStage["key"], string> = {
  leads: "dashboard.stageNewLeads",
  quotes: "dashboard.stageQuotesOut",
  approved: "dashboard.stageApproved",
  scheduled: "dashboard.stageScheduled",
  done: "dashboard.stageDone",
  invoiced: "dashboard.stageInvoiced",
};

export default async function MoneyPipeline({ businessId }: { businessId: string }) {
  const locale: Locale = await getLocale();
  const pipeline = await getMoneyPipeline(businessId);

  const visible = pipeline.stages.filter((s) => s.count > 0);
  const hidden = pipeline.stages.filter((s) => s.count === 0);

  return (
    <section
      aria-label={t(locale, "dashboard.moneyPipeline")}
      className="rounded-[24px] border border-line/70 bg-surface p-5 dark:border-hero-ink/10 dark:bg-coal"
    >
      <h2 className="text-[17px] font-bold text-asphalt dark:text-hero-ink">
        {t(locale, "dashboard.moneyPipeline")}
      </h2>
      <p className="mt-1 text-[15px] text-ink-2 dark:text-ink-2">
        <strong className="ej-figure font-bold text-asphalt tabular-nums dark:text-hero-ink">
          {formatWholeCAD(pipeline.totalInProgress, locale)}
        </strong>{" "}
        {t(locale, "dashboard.inProgressNow")}
      </p>
      {hidden.length > 0 && (
        <p className="mt-2 text-[13px] text-ink-2 dark:text-ink-2">
          {t(locale, "dashboard.pipelineEmptyStages").replace(
            "{stages}",
            joinNames(
              hidden.map((s) => t(locale, STAGE_SHORT_NAMES[s.key])),
              locale
            )
          )}
        </p>
      )}
      {visible.length > 0 && (
        <ol className="relative mt-4 space-y-5">
          <span aria-hidden className="absolute bottom-2 left-[5px] top-2 w-px bg-line dark:bg-surface/10" />
          {visible.map((stage) => (
            <li key={stage.key} className="relative flex items-start gap-3 pl-0">
              <span
                aria-hidden
                className={cn(
                  "relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full",
                  stage.leak ? "bg-safety ring-4 ring-safety/20" : "bg-asphalt dark:bg-line"
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[15px] font-semibold text-asphalt dark:text-hero-ink">
                    {t(locale, STAGE_TITLES[stage.key])}
                  </p>
                  <p className="ej-figure shrink-0 text-[17px] font-bold tabular-nums text-asphalt dark:text-hero-ink">
                    {stage.amount == null ? (
                      <span className="text-[15px]">{stage.count}</span>
                    ) : (
                      formatWholeCAD(stage.amount, locale)
                    )}
                  </p>
                </div>
                <p className="text-[13px] text-ink-2 dark:text-ink-2">
                  <StageHint stage={stage} locale={locale} />
                </p>
                <FixButton stage={stage} locale={locale} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
