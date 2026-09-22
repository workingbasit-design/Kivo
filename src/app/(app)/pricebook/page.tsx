import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import PriceBookClient from '@/components/PriceBookClient';

export const metadata = { title: 'Price Book | Kivo' };

export default async function PriceBookPage() {
  const { businessId } = await requireAuth();
  const __biz = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = __biz?.currency;

  const services = await prisma.service.findMany({
    where: { businessId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, price: true },
  });

  return <PriceBookClient initialServices={services} currency={currency} />;
}
