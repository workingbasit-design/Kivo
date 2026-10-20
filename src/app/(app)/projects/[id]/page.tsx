import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import { localeMoneyTag } from "@/lib/utils";
import { formatMoney, centsToDollars } from "@/lib/money";
import { Card } from '@/components/kit';
import { PhaseCard, AddPhaseForm, type Phase } from "@/components/ProjectPhases";
import { ProjectHeaderForm } from "@/components/ProjectHeaderForm";
import { ArrowLeft } from '@/components/icons';
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
      jobs: { select: { id: true } },
    },
  });

  if (!project) notFound();

  // E6: Money truth — contract price, invoiced, paid, remaining.
  // Invoiced/paid come from non-voided invoices linked to this project's jobs.
  const jobIds = project.jobs.map((j) => j.id);
  let invoicedCents = BigInt(0);
  let paidCents = BigInt(0);
  if (jobIds.length > 0) {
    const invoices = await prisma.invoice.findMany({
      where: { businessId, jobId: { in: jobIds }, voidedAt: null },
      select: {
        totalCents: true,
        payments: { select: { amountCents: true } },
      },
    });
    for (const inv of invoices) {
      invoicedCents += inv.totalCents;
      for (const p of inv.payments) paidCents += p.amountCents;
    }
  }
  const remainingCents = invoicedCents - paidCents;
  const leftToInvoiceCents =
    project.budgetCents != null && BigInt(project.budgetCents) > invoicedCents
      ? BigInt(project.budgetCents) - invoicedCents
      : BigInt(0);

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

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ej-secondary hover:text-ej-ink min-h-[44px]"
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
        <section aria-label={t(locale, 'projects.contractPrice')} className="mt-4 rounded-lg border border-ej-border bg-ej-surface p-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
            <div>
              <dt className="text-sm text-ej-secondary">{t(locale, 'projects.contractPrice')}</dt>
              <dd className="text-base font-bold text-ej-ink tabular-nums">
                {project.budgetCents != null
                  ? formatMoney(project.budgetCents / 100, 'CAD', moneyLocale)
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ej-secondary">{t(locale, 'projects.moneyInvoiced')}</dt>
              <dd className="text-base font-bold text-ej-ink tabular-nums">
                {formatMoney(centsToDollars(invoicedCents), 'CAD', moneyLocale)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ej-secondary">{t(locale, 'projects.moneyPaid')}</dt>
              <dd className="text-base font-bold text-ej-success tabular-nums">
                {formatMoney(centsToDollars(paidCents), 'CAD', moneyLocale)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ej-secondary">{t(locale, 'projects.moneyRemaining')}</dt>
              <dd className="text-base font-bold text-ej-ink tabular-nums">
                {formatMoney(centsToDollars(remainingCents), 'CAD', moneyLocale)}
              </dd>
            </div>
            {leftToInvoiceCents > BigInt(0) && (
              <div>
                <dt className="text-sm text-ej-secondary">{t(locale, 'projects.moneyLeftToInvoice')}</dt>
                <dd className="text-base font-bold text-ej-warning tabular-nums">
                  {formatMoney(centsToDollars(leftToInvoiceCents), 'CAD', moneyLocale)}
                </dd>
              </div>
            )}
          </dl>
        </section>
        {phases.length > 0 && (
          <>
            <p className="text-sm text-ej-secondary mt-4">
              {t(locale, "projects.progress")
                .replace("{done}", String(donePhases))
                .replace("{total}", String(phases.length))}
            </p>
            <div
              className="h-2 rounded-full bg-ej-border mt-2 overflow-hidden"
              role="progressbar"
              aria-valuenow={donePhases}
              aria-valuemin={0}
              aria-valuemax={phases.length}
              aria-label={t(locale, "projects.progress")
                .replace("{done}", String(donePhases))
                .replace("{total}", String(phases.length))}
            >
              <div
                className="h-full rounded-full bg-ej-ink"
                style={{ width: `${Math.round((donePhases / phases.length) * 100)}%` }}
              />
            </div>
          </>
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
