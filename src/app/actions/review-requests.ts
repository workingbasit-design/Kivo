'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { unsafeUnscoped } from '@/lib/tenant-guard';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { publicClientIp } from '@/lib/directory';
import {
  newReviewTokenValue,
  hashReviewToken,
  isReviewRequestActive,
  reviewRequestExpiry,
} from '@/lib/review-tokens';
import { getReviewEligibility } from '@/lib/review-eligibility';
import { checkBotSignals } from '@/lib/review-guards';

export type ReviewRequestResult = {
  error?: string;
  ok?: boolean;
  /** Raw token value — shown to the pro once, never stored. */
  token?: string;
};

/**
 * Pro generates a single-use review link for a job. Allowed ONLY when the
 * job is complete AND the customer has a paid invoice (both verified
 * server-side). Any older pending link for the same job is revoked, so
 * there is exactly one active link per job.
 */
export async function createReviewRequest(
  jobId: string
): Promise<ReviewRequestResult> {
  const { businessId } = await requireAuth();
  const rl = rateLimit(`review-request:${businessId}`, ACTION_LIMIT);
  if (!rl.ok) return { error: 'Too many requests. Please slow down.' };

  const elig = await getReviewEligibility(businessId, jobId);
  if (!elig.ok) {
    return {
      error:
        'A review link can only be created for a completed job with a paid invoice.',
    };
  }

  const token = newReviewTokenValue();
  const tokenHash = hashReviewToken(token);

  await prisma.$transaction([
    prisma.reviewRequest.updateMany({
      where: { jobId: elig.job.id, businessId, status: 'PENDING' },
      data: { status: 'REVOKED' },
    }),
    prisma.reviewRequest.create({
      data: {
        tokenHash,
        jobId: elig.job.id,
        customerId: elig.job.customerId,
        businessId,
        expiresAt: reviewRequestExpiry(),
      },
    }),
  ]);

  revalidatePath('/marketing/reviews');
  return { ok: true, token };
}

/** Pro revokes a pending review link (e.g. sent to the wrong customer). */
export async function revokeReviewRequest(
  requestId: string
): Promise<ReviewRequestResult> {
  const { businessId } = await requireAuth();
  const rl = rateLimit(`review-request:${businessId}`, ACTION_LIMIT);
  if (!rl.ok) return { error: 'Too many requests. Please slow down.' };

  const existing = await prisma.reviewRequest.findFirst({
    where: { id: requestId, businessId },
    select: { id: true, status: true },
  });
  if (!existing) return { error: 'Review link not found.' };
  if (existing.status !== 'PENDING') return { error: 'This link is already used or expired.' };

  await prisma.reviewRequest.update({
    where: { id: requestId, businessId },
    data: { status: 'REVOKED' },
  });
  revalidatePath('/marketing/reviews');
  return { ok: true };
}

const tokenSubmitSchema = z.object({
  token: z.string().trim().min(1).max(200),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().default(''),
  // Honeypot: real users never fill this (it's visually hidden).
  honeypot: z.string().max(500).optional().default(''),
  renderedAtMs: z.coerce.number(),
});

// Public token form: rate-limited per business AND per IP, on top of the
// unguessable single-use token itself.
const TOKEN_SUBMIT_BUSINESS_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 };
const TOKEN_SUBMIT_IP_LIMIT = { limit: 20, windowMs: 10 * 60 * 1000 };

const STALE_LINK_ERROR =
  'This review link is no longer valid. Ask your pro for a fresh one.';

/**
 * Public review submission — NO auth. The ONLY way a review is created
 * without the pro being signed in is with a valid, unused, unexpired,
 * unrevoked single-use token. There is no open submission path anymore.
 */
export async function submitTokenReview(
  _prev: ReviewRequestResult,
  formData: FormData
): Promise<ReviewRequestResult> {
  const parsed = tokenSubmitSchema.safeParse({
    token: formData.get('token'),
    rating: formData.get('rating'),
    comment: formData.get('comment'),
    honeypot: formData.get('honeypot'),
    renderedAtMs: formData.get('renderedAtMs'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please pick a star rating.' };
  }
  const { token, rating, comment, honeypot, renderedAtMs } = parsed.data;

  // Bot protection (CAPTCHA-or-equivalent): honeypot + minimum fill time,
  // validated server-side. Deliberately vague error — don't coach bots.
  const bot = checkBotSignals({ honeypot, renderedAtMs });
  if (!bot.ok) return { error: 'Something went wrong — please try again.' };

  const tokenHash = hashReviewToken(token);
  // Public token lookup: the 256-bit review token IS the authorization
  // (capability URL). The business/customer/job are learned from the resolved
  // row, so no tenant scope can exist before this lookup.
  const req = await unsafeUnscoped('review-requests:resolveTokenSubmit', () =>
    prisma.reviewRequest.findUnique({
      where: { tokenHash },
      select: {
        businessId: true,
        jobId: true,
        customerId: true,
        status: true,
        expiresAt: true,
      },
    })
  );
  if (!req || !isReviewRequestActive(req)) return { error: STALE_LINK_ERROR };

  const ip = await publicClientIp();
  const rlBiz = rateLimit(
    `review-token:${req.businessId}`,
    TOKEN_SUBMIT_BUSINESS_LIMIT
  );
  if (!rlBiz.ok) return { error: 'Too many reviews. Please try again later.' };
  const rlIp = rateLimit(`review-token-ip:${ip}`, TOKEN_SUBMIT_IP_LIMIT);
  if (!rlIp.ok) return { error: 'Too many reviews. Please try again later.' };

  // Atomic single-use: re-check the token INSIDE the transaction so two
  // simultaneous submits can't both create reviews (double-submit race).
  try {
    await prisma.$transaction(async (tx) => {
      // Same capability-token justification as the lookup above; re-checked
      // inside the transaction for the atomic single-use guarantee.
      const fresh = await unsafeUnscoped('review-requests:recheckToken', () =>
        tx.reviewRequest.findUnique({
          where: { tokenHash },
          select: { status: true, expiresAt: true },
        })
      );
      if (!fresh || !isReviewRequestActive(fresh)) throw new Error('STALE_TOKEN');
      const review = await tx.review.create({
        data: {
          rating,
          comment: comment || null,
          source: 'Verified',
          customerId: req.customerId,
          jobId: req.jobId,
          businessId: req.businessId,
        },
      });
      // Same capability-token justification as the lookups above: the token
      // proves the caller may act on this request; no tenant scope exists.
      await unsafeUnscoped('review-requests:markTokenUsed', () =>
        tx.reviewRequest.update({
          where: { tokenHash },
          data: { status: 'USED', usedAt: new Date(), reviewId: review.id },
        })
      );
    });
  } catch {
    return { error: STALE_LINK_ERROR };
  }

  return { ok: true };
}

export type TokenReviewContext = {
  businessName: string;
  customerName: string;
  jobTitle: string;
  jobDate: Date;
} | null;

/**
 * Public-safe context for the /rev/[token] page. Returns null for any
 * invalid, used, revoked, or expired token. Only names/titles are exposed —
 * never emails, phones, addresses, or financials.
 */
export async function getTokenReviewContext(
  token: string
): Promise<TokenReviewContext> {
  if (!token || token.length > 200) return null;
  // Public token lookup: the review token IS the authorization (capability
  // URL). Only names/titles are exposed — never emails, phones, addresses,
  // or financials.
  const req = await unsafeUnscoped('review-requests:resolveTokenContext', () =>
    prisma.reviewRequest.findUnique({
      where: { tokenHash: hashReviewToken(token.trim()) },
      select: {
        status: true,
        expiresAt: true,
        job: { select: { title: true, date: true } },
        customer: { select: { name: true } },
        business: { select: { name: true } },
      },
    })
  );
  if (!req || !isReviewRequestActive(req)) return null;
  return {
    businessName: req.business.name,
    customerName: req.customer.name,
    jobTitle: req.job.title,
    jobDate: req.job.date,
  };
}
