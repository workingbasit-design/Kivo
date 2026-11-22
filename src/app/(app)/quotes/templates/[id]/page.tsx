import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { canSeePrices } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { centsToDollars } from '@/lib/money';
import { PageTitle } from '../../../_components/PageTitle';
import { Button } from '@/components/kit';
import TemplateForm from '../TemplateForm';

/** Slice 4: edit template (name + lines). Delete lives here too. */
export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { businessId, role } = await requireAuth();

  if (!canSeePrices(role)) {
    redirect('/dashboard');
  }

  const locale = await getLocale();
  const { id } = await params;
  const template = await prisma.quoteTemplate.findFirst({
    where: { id, businessId },
    include: { items: { orderBy: { position: 'asc' } } },
  });
  if (!template) {
    redirect('/quotes/templates');
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title={t(locale, 'quotes.templates.editTemplate')}
        summary={template.name}
      />
      {/* 2026-11-22 deep test: the detail page was an edit-only dead end —
          the only way to start a quote from a template was the picker on
          /quotes/new. This button opens a pre-filled new quote from it. */}
      <div>
        <Button href={`/quotes/new?template=${template.id}`}>
          {t(locale, 'quotes.templates.useThisTemplate')}
        </Button>
      </div>
      <TemplateForm
        template={{
          id: template.id,
          name: template.name,
          items: template.items.map((li) => ({
            desc: li.description,
            qty: String(li.qty),
            rate: String(centsToDollars(li.unitPriceCents)),
            cost:
              li.unitCostCents == null
                ? ''
                : String(centsToDollars(li.unitCostCents)),
          })),
        }}
        locale={locale}
      />
    </div>
  );
}
