import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import { localeMoneyTag } from "@/lib/utils";
import { formatMoney, centsToDollars } from "@/lib/money";
import { Card } from "@/components/ui";
import { PhaseCard, AddPhaseForm, type Phase } from "@/components/ProjectPhases";
import { ProjectHeaderForm } from "@/components/ProjectHeaderForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const moneyLocale = localeMoneyTag(locale);
  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, businessId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      budgetCents: true,
      startDate: true,
      endDate: true,
      customer: { select: { name: true } },
      phases: {
        select: {
          id: true,
          name: true,
          order: true,
          status: true,
          jobs: {
            select: {
              id: true,
              title: true,
              status: true,
              priceCents: true,
              date: true,
              customer: { select: { name: true } },
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!project) notFound();

  const phases: Phase[] = project.phases.map((ph) => ({
    id: ph.id,
    name: ph.name,
    order: ph.order,
    status: ph.status,
    jobs: ph.jobs.map((j) => ({
      id: j.id,
      title: j.title,
      status: j.status,
      price: centsToDollars(j.priceCents),
      customerName: j.customer.name,
      date: new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
        month: "short",
        day: "numeric",
      }).format(j.date),
    })),
  }));

  const donePhases = phases.filter((p) => p.status === "DONE").length;
  const jobValue = phases.reduce(
    (s, p) => s + p.jobs.reduce((ss, j) => ss + j.price, 0),
    0
  );

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-600 hover:text-zinc-900 min-h-[44px]"
      >
        <ArrowLeft size={16} aria-hidden /> {t(locale, "projects.back")}
      </Link>

      <Card className="p-5">
        <ProjectHeaderForm
          locale={locale}
          project={{
            id: project.id,
            title: project.title,
            description: project.description,
            status: project.status,
            budgetCents: project.budgetCents,
            customerName: project.customer?.name ?? null,
          }}
          moneyLocale={moneyLocale}
        />
        <div className="flex flex-wrap gap-4 mt-4 text-sm text-zinc-600">
          {project.budgetCents != null && (
            <span>
              {t(locale, "projects.budget")}:{" "}
              <strong className="text-zinc-900 tabular-nums">
                {formatMoney(project.budgetCents / 100, "CAD", moneyLocale)}
              </strong>
            </span>
          )}
          <span>
            {t(locale, "projects.spent")}:{" "}
            <strong className="text-zinc-900 tabular-nums">
              {formatMoney(jobValue, "CAD", moneyLocale)}
            </strong>
          </span>
          {phases.length > 0 && (
            <span>
              {t(locale, "projects.progress")
                .replace("{done}", String(donePhases))
                .replace("{total}", String(phases.length))}
            </span>
          )}
        </div>
        {phases.length > 0 && (
          <div className="h-2 rounded-full bg-zinc-100 mt-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-lime-500 transition-all"
              style={{ width: `${Math.round((donePhases / phases.length) * 100)}%` }}
            />
          </div>
        )}
      </Card>

      <section className="space-y-3">
        {phases.map((ph) => (
          <PhaseCard
            key={ph.id}
            locale={locale}
            projectId={project.id}
            phase={ph}
            moneyLocale={moneyLocale}
          />
        ))}
        <AddPhaseForm locale={locale} projectId={project.id} />
      </section>
    </div>
  );
}
