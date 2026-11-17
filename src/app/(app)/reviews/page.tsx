import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';

import ReviewsClient from '@/components/ReviewsClient';
import GoogleReviewsPanel from '@/components/GoogleReviewsPanel';
import { getGoogleStatus } from '@/app/actions/google-reviews';
import { listEligibleReviewJobs } from '@/lib/review-eligibility';
import { classifyLegacySource } from '@/lib/review-guards';
import { PageTitle } from '../_components/PageTitle';
import { parseListLimit, takeWithProbe, sliceListPage } from '@/lib/list-page';
import { ListMore } from '../_components/ListMore';

export const metadata = { title: 'Reviews | EveryJob' };

/**
 * Eligibility window start, evaluated fresh per request. Plain module helper
 * (not a component) so the impure Date.now() stays out of render.
 */
function eligibilitySince(): Date {
  return new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
}

// Review-moat: the add dialog offers only eligible jobs (completed + paid
// invoice). Older sources are shown as "Legacy" - only Verified and Google
// keep their badge.

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams?: Promise<{ limit?: string }>;
}) {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const limit = parseListLimit((await searchParams)?.limit);

  const [fetched, eligibleJobs, agg, googleStatus] = await Promise.all([
    prisma.review.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true } } },
      take: takeWithProbe(limit),
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
  const average = total > 0 && agg._avg.rating ? agg._avg.rating.toFixed(1) : '-';
  // M3: bounded read; total/average already come from the database aggregate.
  const page = sliceListPage(fetched, limit);
  const reviews = page.rows;

  return (
    <div className="space-y-6">
      <PageTitle
        title={t(locale, 'reviewsPage.title')}
        summary={t(locale, 'reviewsPage.subtitle')}
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
      <ListMore
        shown={reviews.length}
        total={total}
        nextLimit={page.nextLimit}
        locale={locale}
        basePath="/reviews"
      />
    </div>
  );
}
