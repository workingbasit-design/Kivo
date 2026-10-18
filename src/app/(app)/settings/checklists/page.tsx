import Link from 'next/link';
import { ArrowLeft } from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { centsToDollars } from '@/lib/money';

import { ChecklistTemplatesClient } from '@/components/ChecklistTemplatesClient';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageTitle } from '../../_components/PageTitle';

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
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft size={14} /> {t(locale, 'jobops.templates.backToSettings')}
      </Link>
      <PageTitle
        title={t(locale, 'jobops.templates.title')}
        summary={t(locale, 'jobops.templates.subtitle')}
      />
      <ChecklistTemplatesClient
        locale={locale}
        templates={templates.map((tpl) => ({
          id: tpl.id,
          name: tpl.name,
          items: tpl.items.map((i) => i.label),
          price: tpl.priceCents == null ? null : centsToDollars(tpl.priceCents),
          durationMin: tpl.durationMin,
          notes: tpl.notes,
        }))}
      />
    </div>
  );
}
