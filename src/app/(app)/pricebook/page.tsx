import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { centsToDollars } from '@/lib/money';
import PriceBookClient from '@/components/PriceBookClient';
import { parseListLimit, takeWithProbe, sliceListPage } from '@/lib/list-page';
import { ListMore } from '../_components/ListMore';

export const metadata = { title: 'Price Book | EveryJob' };

export default async function PriceBookPage({
  searchParams,
}: {
  searchParams?: Promise<{ limit?: string }>;
}) {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const limit = parseListLimit((await searchParams)?.limit);
  const __biz = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = __biz?.currency;

  // M3: bounded read + exact total from the database.
  const [fetched, total] = await Promise.all([
    prisma.service.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
      take: takeWithProbe(limit),
    select: {
      id: true,
      name: true,
      priceCents: true,
      durationMin: true,
      description: true,
      iconKey: true,
      // DB-audit m2: the form now writes these; the client renders them.
      nameFr: true,
      descriptionFr: true,
      category: true,
      unit: true,
      kind: true,
      taxCategory: true,
      costCents: true,
    },
  }),
    prisma.service.count({ where: { businessId } }),
  ]);
  const page = sliceListPage(fetched, limit);
  const services = page.rows;

  const initialServices = services.map((s) => ({
    id: s.id,
    name: s.name,
    price: centsToDollars(s.priceCents),
    durationMin: s.durationMin,
    description: s.description,
    iconKey: s.iconKey,
    nameFr: s.nameFr,
    descriptionFr: s.descriptionFr,
    category: s.category,
    unit: s.unit,
    kind: s.kind,
    taxCategory: s.taxCategory,
    cost: s.costCents == null ? null : centsToDollars(s.costCents),
  }));

  return (
    <>
      <PriceBookClient initialServices={initialServices} currency={currency} locale={locale} />
      <ListMore
        shown={initialServices.length}
        total={total}
        nextLimit={page.nextLimit}
        locale={locale}
        basePath="/pricebook"
      />
    </>
  );
}
