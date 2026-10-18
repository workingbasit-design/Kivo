import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import { Card } from '@/components/kit';
import { NewProjectForm } from "@/components/NewProjectForm";
import { ArrowLeft } from '@/components/icons';
import Link from "next/link";
import { PageTitle } from '../../_components/PageTitle';

export default async function NewProjectPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();

  const customers = await prisma.customer.findMany({
    where: { businessId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  });

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink min-h-[44px]"
      >
        <ArrowLeft size={16} aria-hidden /> {t(locale, "projects.back")}
      </Link>
      <PageTitle title={t(locale, "projects.new")} />
      <Card className="p-5">
        <NewProjectForm locale={locale} customers={customers} />
      </Card>
    </div>
  );
}
