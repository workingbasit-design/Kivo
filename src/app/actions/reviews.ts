'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { getReviewEligibility } from '@/lib/review-eligibility';

export type ReviewResult = { error?: string; ok?: boolean };

const reviewSchema = z.object({
  rating: z.coerce.number().int('Rating must be a whole number').min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z.string().trim().max(2000).optional().default(''),
  // The completed, paid job this review is about — required. This is the
  // review moat: even owner-recorded reviews must tie to a real job, never
  // anonymous, never free-floating.
  jobId: z.string().trim().min(1, 'Pick the completed job this review is for.'),
});

function limited(businessId: string): ReviewResult | null {
  const rl = rateLimit(`reviews:${businessId}`, ACTION_LIMIT);
  if (!rl.ok) return { error: 'Too many requests. Please slow down.' };
  return null;
}

/** Create a review, always linked to a completed, paid job. For useActionState. */
export async function createReview(
  _prev: ReviewResult,
  formData: FormData
): Promise<ReviewResult> {
  const { businessId } = await requireAuth();
  const hit = limited(businessId);
  if (hit) return hit;

  const parsed = reviewSchema.safeParse({
    rating: formData.get('rating'),
    comment: formData.get('comment'),
    jobId: formData.get('jobId'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid review details.' };
  }
  const { rating, comment, jobId } = parsed.data;

  // Moat check, server-side: the job must be complete AND the customer must
  // have a paid invoice. No job → no review, no exceptions.
  const elig = await getReviewEligibility(businessId, jobId);
  if (!elig.ok) {
    return {
      error:
        'Reviews can only be recorded for a completed job with a paid invoice.',
    };
  }

  await prisma.review.create({
    data: {
      rating,
      comment: comment || null,
      source: 'Verified',
      customerId: elig.job.customerId,
      jobId: elig.job.id,
      businessId,
    },
  });
  revalidatePath('/reviews');
  return { ok: true };
}

/** Delete a review. */
export async function deleteReview(id: string): Promise<ReviewResult> {
  const { businessId } = await requireAuth();
  const hit = limited(businessId);
  if (hit) return hit;

  const existing = await prisma.review.findFirst({ where: { id, businessId } });
  if (!existing) return { error: 'Review not found.' };

  await prisma.review.delete({ where: { id, businessId } });
  revalidatePath('/reviews');
  return { ok: true };
}
