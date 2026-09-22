'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';

export type ReviewResult = { error?: string; ok?: boolean };

const reviewSchema = z.object({
  rating: z.coerce.number().int('Rating must be a whole number').min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z.string().trim().max(2000).optional().default(''),
  source: z.string().trim().max(100).optional().default(''),
  customerId: z.string().trim().optional().default(''),
});

function limited(businessId: string): ReviewResult | null {
  const rl = rateLimit(`reviews:${businessId}`, ACTION_LIMIT);
  if (!rl.ok) return { error: 'Too many requests. Please slow down.' };
  return null;
}

/** Create a review, optionally linked to a customer. For useActionState. */
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
    source: formData.get('source'),
    customerId: formData.get('customerId'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid review details.' };
  }
  const { rating, comment, source } = parsed.data;
  const rawCustomerId = parsed.data.customerId;

  // Verify the customer belongs to this business when one is linked.
  let customerId: string | null = null;
  if (rawCustomerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: rawCustomerId, businessId },
      select: { id: true },
    });
    if (!customer) return { error: 'Selected customer not found.' };
    customerId = customer.id;
  }

  await prisma.review.create({
    data: {
      rating,
      comment: comment || null,
      source: source || null,
      customerId,
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

  await prisma.review.delete({ where: { id } });
  revalidatePath('/reviews');
  return { ok: true };
}
