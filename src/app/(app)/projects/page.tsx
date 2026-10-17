import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import { localeMoneyTag } from "@/lib/utils";
import { formatMoney, centsToDollars } from "@/lib/money";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { FolderKanban, Plus, ArrowRight } from '@/components/icons';
import Link from "next/link";

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  ON_HOLD: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-line text-ink",
  CANCELLED: "bg-surface-2 text-ink-2",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "projects.statusActive",
  ON_HOLD: "projects.statusOnHold",
  COMPLETED: "projects.statusCompleted",
  CANCELLED: "projects.statusCancelled",
};

export default async function ProjectsPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const moneyLocale = localeMoneyTag(locale);

  const projects = await prisma.project.findMany({
    where: { businessId },
    select: {
      id: true,
      title: true,
      status: true,
      budgetCents: true,
      startDate: true,
      endDate: true,
      customer: { select: { name: true } },
      phases: { select: { id: true, status: true } },
      jobs: { select: { id: true, priceCents: true } },
    },
    orderBy: { updatedAt: "desc" },
  }).catch(() => []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "projects.title")}
        subtitle={t(locale, "projects.subtitle")}
        actions={
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-lime-500 text-ink text-sm font-bold hover:bg-lime-400 transition-colors min-h-[44px]"
          >
            <Plus size={16} aria-hidden /> {t(locale, "projects.new")}
          </Link>
        }
      />

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban size={28} className="text-ink-2" aria-hidden />}
            title={t(locale, "projects.noProjects")}
            description={t(locale, "projects.noProjectsDesc")}
            action={
              <Link
                href="/projects/new"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-lime-500 text-ink text-sm font-bold hover:bg-lime-400 transition-colors min-h-[44px]"
              >
                <Plus size={16} aria-hidden /> {t(locale, "projects.createFirst")}
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => {
            const donePhases = p.phases.filter((ph) => ph.status === "DONE").length;
            const jobValue = p.jobs.reduce((s, j) => s + centsToDollars(j.priceCents), 0);
            return (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="p-5 hover:shadow-lg transition-shadow h-full">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-ink leading-snug">{p.title}</h3>
                    <span
                      className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-full ${STATUS_TONE[p.status] ?? STATUS_TONE.ACTIVE}`}
                    >
                      {t(locale, STATUS_LABEL[p.status] ?? "projects.statusActive")}
                    </span>
                  </div>
                  {p.customer && (
                    <p className="text-xs text-ink-2 mb-2">{p.customer.name}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-ink-2 mt-3">
                    <span>
                      {p.phases.length === 0
                        ? t(locale, "projects.noJobs")
                        : t(locale, "projects.progress")
                            .replace("{done}", String(donePhases))
                            .replace("{total}", String(p.phases.length))}
                    </span>
                    <span>·</span>
                    <span>
                      {p.jobs.length} {t(locale, "projects.jobs").toLowerCase()}
                    </span>
                    {p.budgetCents != null && (
                      <>
                        <span>·</span>
                        <span className="font-semibold text-ink tabular-nums">
                          {formatMoney(p.budgetCents / 100, "CAD", moneyLocale)}
                        </span>
                      </>
                    )}
                  </div>
                  {p.phases.length > 0 && (
                    <div className="h-1.5 rounded-full bg-surface-2 mt-3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-lime-500 transition-all"
                        style={{ width: `${Math.round((donePhases / p.phases.length) * 100)}%` }}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs font-semibold text-ink-2 tabular-nums">
                      {t(locale, "projects.spent")}: {formatMoney(jobValue, "CAD", moneyLocale)}
                    </span>
                    <ArrowRight size={16} className="text-ink-2" aria-hidden />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
