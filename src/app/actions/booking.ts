'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';

export type BookingResult = { error?: string; ok?: boolean };

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Link must be at least 3 characters')
  .max(60, 'Link must be 60 characters or less')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers and hyphens only'
  );

const bookingSettingsSchema = z.object({
  enabled: z.coerce.boolean(),
  slug: slugSchema,
  headline: z.string().trim().max(120).optional().default(''),
  intro: z.string().trim().max(1000).optional().default(''),
});

/* ------------------------------------------------------------------ */
/* Business settings (authenticated)                                   */
/* ------------------------------------------------------------------ */

/**
 * Create or update this business's public booking page.
 * Slug is globally unique — reject if another business already uses it.
 */
export async function saveBookingSettings(
  _prev: BookingResult,
  formData: FormData
): Promise<BookingResult> {
  const { businessId } = await requireAuth();
  const rl = rateLimit(`booking-settings:${businessId}`, ACTION_LIMIT);
  if (!rl.ok) return { error: 'Too many requests. Please slow down.' };

  const parsed = bookingSettingsSchema.safeParse({
    enabled: formData.get('enabled') === 'on',
    slug: formData.get('slug'),
    headline: formData.get('headline'),
    intro: formData.get('intro'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid booking settings.' };
  }
  const { enabled, slug, headline, intro } = parsed.data;

  const clash = await prisma.bookingPage.findFirst({
    where: { slug, NOT: { businessId } },
    select: { id: true },
  });
  if (clash) {
    return { error: 'This booking link is already taken. Try another one.' };
  }

  await prisma.bookingPage.upsert({
    where: { businessId },
    create: {
      businessId,
      slug,
      enabled,
      headline: headline || null,
      intro: intro || null,
    },
    update: {
      slug,
      enabled,
      headline: headline || null,
      intro: intro || null,
    },
  });

  revalidatePath('/settings/booking');
  revalidatePath(`/book/${slug}`);
  return { ok: true };
}
