import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listEligibleReviewJobs } from '@/lib/review-eligibility';
import { formatDateShort } from '@/lib/utils';
import ReviewRequestsClient, {
  type ReviewRequestRow,
} from '@/components/ReviewRequestsClient';
import { getLocale } from '@/lib/i18n/server';

export const metadata = { title: 'Review requests | EveryJob' };

// Review-moat: only completed jobs with a paid invoice can get a review
// link. Jobs that already received a token-linked review are excluded.

export default async function ReviewRequestsPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();

  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const eligible = await listEligibleReviewJobs(businessId, since);
  const jobIds = eligible.map((j) => j.id);

  const reviewed = jobIds.length
    ? await prisma.review.findMany({
        where: { businessId, jobId: { in: jobIds } },
        select: { jobId: true },
      })
    : [];
  const reviewedIds = new Set(
    reviewed.map((r) => r.jobId).filter((id): id is string => !!id)
  );

  const rows: ReviewRequestRow[] = eligible
    .filter((j) => !reviewedIds.has(j.id))
    .map((j) => ({
      jobId: j.id,
      jobTitle: j.title,
      customerName: j.customer.name,
      dateLabel: formatDateShort(
        j.date,
        locale === 'fr' ? 'fr-CA' : 'en-CA'
      ),
    }));

  return (
    <div className="space-y-6 max-w-3xl">
      <ReviewRequestsClient rows={rows} locale={locale} />
    </div>
  );
}
