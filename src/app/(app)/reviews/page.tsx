import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui';
import ReviewsClient from '@/components/ReviewsClient';

export const metadata = { title: 'Reviews | EveryJob' };

export default async function ReviewsPage() {
  const { businessId } = await requireAuth();

  const [reviews, customers, agg] = await Promise.all([
    prisma.review.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true } } },
    }),
    prisma.customer.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.review.aggregate({
      where: { businessId },
      _avg: { rating: true },
      _count: { id: true },
    }),
  ]);

  const total = agg._count.id;
  const average = total > 0 && agg._avg.rating ? agg._avg.rating.toFixed(1) : '—';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        subtitle="Track what customers say about your work."
      />
      <ReviewsClient
        reviews={reviews.map(
          (r: {
            id: string;
            rating: number;
            comment: string | null;
            source: string | null;
            customer: { name: string } | null;
            createdAt: Date;
          }) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            source: r.source,
            customerName: r.customer?.name ?? null,
            createdAt: r.createdAt.toISOString(),
          })
        )}
        customers={customers}
        average={average}
        total={total}
      />
    </div>
  );
}
