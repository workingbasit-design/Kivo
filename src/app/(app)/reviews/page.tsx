import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui';
import ReviewsClient from '@/components/ReviewsClient';
import GoogleReviewsPanel from '@/components/GoogleReviewsPanel';
import { getGoogleStatus } from '@/app/actions/google-reviews';
import { listEligibleReviewJobs } from '@/lib/review-eligibility';
import { classifyLegacySource } from '@/lib/review-guards';

export const metadata = { title: 'Reviews | EveryJob' };

/**
 * Eligibility window start, evaluated fresh per request. Plain module helper
 * (not a component) so the impure Date.now() stays out of render.
 */
function eligibilitySince(): Date {
  return new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
}

// Review-moat: the add dialog offers only eligible jobs (completed + paid
// invoice). Older sources are shown as "Legacy" — only Verified and Google
// keep their badge.

export default async function ReviewsPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();

  const [reviews, eligibleJobs, agg, googleStatus] = await Promise.all([
    prisma.review.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true } } },
    }),
    listEligibleReviewJobs(
      businessId,
      eligibilitySince()
    ),
    prisma.review.aggregate({
      where: { businessId },
      _avg: { rating: true },
      _count: { id: true },
    }),
    getGoogleStatus(),
  ]);

  const total = agg._count.id;
  const average = total > 0 && agg._avg.rating ? agg._avg.rating.toFixed(1) : '—';

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, 'reviewsPage.title')}
        subtitle={t(locale, 'reviewsPage.subtitle')}
      />
      <GoogleReviewsPanel status={googleStatus} locale={locale} />
      <ReviewsClient
        locale={locale}
        reviews={reviews.map(
          (r: {
            id: string;
            rating: number;
            comment: string | null;
            source: string | null;
            reviewerName: string | null;
            reviewedAt: Date | null;
            customer: { name: string } | null;
            createdAt: Date;
          }) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            source: classifyLegacySource(r.source),
            verified: r.source === 'Verified',
            reviewerName: r.reviewerName,
            reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
            customerName: r.customer?.name ?? null,
            createdAt: r.createdAt.toISOString(),
          })
        )}
        eligibleJobs={eligibleJobs.map((j) => ({
          id: j.id,
          title: j.title,
          customerName: j.customer.name,
        }))}
        average={average}
        total={total}
      />
    </div>
  );
}
