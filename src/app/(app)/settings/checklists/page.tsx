import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui';
import { ChecklistTemplatesClient } from '@/components/ChecklistTemplatesClient';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

export const metadata = { title: 'Checklist templates | EveryJob' };

export default async function ChecklistTemplatesPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();

  const templates = await prisma.checklistTemplate.findMany({
    where: { businessId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft size={14} /> {t(locale, 'jobops.templates.backToSettings')}
      </Link>
      <PageHeader
        title={t(locale, 'jobops.templates.title')}
        subtitle={t(locale, 'jobops.templates.subtitle')}
      />
      <ChecklistTemplatesClient
        locale={locale}
        templates={templates.map((tpl) => ({
          id: tpl.id,
          name: tpl.name,
          items: tpl.items.map((i) => i.label),
        }))}
      />
    </div>
  );
}
