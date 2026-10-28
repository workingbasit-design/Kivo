import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { canSeePrices } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageTitle } from '../../_components/PageTitle';
import { Button, Card } from '@/components/kit';

/**
 * Slice 4: quote template list. Server-rendered — deletion lives on the
 * edit page, so this page needs no client component.
 */
export default async function TemplatesPage() {
  const { businessId, role } = await requireAuth();

  // SEE_PRICES gate: templates are money data (prices + costs).
  if (!canSeePrices(role)) {
    redirect('/dashboard');
  }

  const locale = await getLocale();
  const templates = await prisma.quoteTemplate.findMany({
    where: { businessId },
    include: {
      _count: { select: { items: true } },
      items: { orderBy: { position: 'asc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <PageTitle
        title={t(locale, 'quotes.templates.title')}
        summary={t(locale, 'quotes.templates.subtitle')}
      />
      <div>
        <Button variant="primary" href="/quotes/templates/new">
          {t(locale, 'quotes.templates.newTemplate')}
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="p-6 space-y-2">
          <p className="font-bold text-ink">
            {t(locale, 'quotes.templates.emptyTitle')}
          </p>
          <p className="text-sm text-ink-2">
            {t(locale, 'quotes.templates.emptyDesc')}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => {
            const count = tpl._count.items;
            const countLabel =
              count === 1
                ? t(locale, 'quotes.templates.lineOne')
                : t(locale, 'quotes.templates.lineOther').replace(
                    '{count}',
                    String(count)
                  );
            const first = tpl.items[0];
            return (
              <Card key={tpl.id} className="p-4">
                <Link
                  href={`/quotes/templates/${tpl.id}`}
                  className="font-bold text-ink hover:underline"
                >
                  {tpl.name}
                </Link>
                <p className="text-sm text-ink-2 mt-1">
                  {countLabel}
                  {first ? ` · ${first.description}` : ''}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
