import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { canSeePrices } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { centsToDollars } from '@/lib/money';
import { PageTitle } from '../../../_components/PageTitle';
import TemplateForm, { type TemplateInput } from '../TemplateForm';

/**
 * Slice 4: new template. `?fromQuote=<id>` prefills name + lines from
 * that quote (tenant-scoped) — the quote detail page's "Save as
 * template" button lands here. The prefill is a copy: saving creates a
 * standalone template, never a link back to the quote.
 */
export default async function NewTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ fromQuote?: string }>;
}) {
  const { businessId, role } = await requireAuth();

  if (!canSeePrices(role)) {
    redirect('/dashboard');
  }

  const locale = await getLocale();
  const { fromQuote } = await searchParams;

  let prefill: TemplateInput | null = null;
  let fromQuoteTitle: string | null = null;
  if (fromQuote) {
    const quote = await prisma.quote.findFirst({
      where: { id: fromQuote, businessId },
      include: { lineItems: { orderBy: { position: 'asc' } } },
    });
    if (quote) {
      fromQuoteTitle = quote.title;
      prefill = {
        id: '',
        name: quote.title,
        items: quote.lineItems.map((li) => ({
          desc: li.description,
          qty: String(li.qty),
          rate: String(centsToDollars(li.unitPriceCents)),
          cost:
            li.unitCostCents == null
              ? ''
              : String(centsToDollars(li.unitCostCents)),
        })),
      };
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title={t(locale, 'quotes.templates.newTemplate')}
        summary={t(locale, 'quotes.templates.subtitle')}
      />
      <TemplateForm
        template={prefill}
        fromQuoteTitle={fromQuoteTitle}
        locale={locale}
      />
    </div>
  );
}
