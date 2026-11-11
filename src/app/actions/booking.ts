'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { unsafeUnscoped } from '@/lib/tenant-guard';

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
 * Slug is globally unique - reject if another business already uses it.
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

  // Global slug uniqueness: slugs live in the public /book/[slug] URL
  // namespace, so the clash check must span all businesses and exclude only
  // this business's own page. The nested NOT: { businessId } is deliberate
  // here (we WANT other tenants' rows) and therefore wrapped in
  // unsafeUnscoped - the guard's top-level-businessId rule would otherwise
  // reject it.
  const clash = await unsafeUnscoped('booking:slugClashCheck', (db) =>
    db.bookingPage.findFirst({
      where: { slug, NOT: { businessId } },
      select: { id: true },
    })
  );
  if (clash) {
    return { error: 'This booking link is already taken. Try another one.' };
  }

  const bookingPage = await prisma.bookingPage.upsert({
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

  // M1: sync the curated bookable-service list. The public page reads
  // BookableService, not every Service row, so this is what decides what a
  // customer can actually book.
  const requestedIds = formData.getAll('bookableServiceIds').map(String).filter(Boolean);
  // Only this business's own services may be listed - never trust ids from
  // the form. Anything else is dropped silently rather than erroring, so a
  // stale tab cannot wedge the whole save.
  const ownServices = await prisma.service.findMany({
    where: { businessId, id: { in: requestedIds.length ? requestedIds : ['__none__'] } },
    select: { id: true },
  });
  const selectedIds = ownServices.map((x) => x.id);

  await prisma.$transaction([
    // Unticked services are removed outright rather than left active: the
    // unique([bookingPageId, serviceId]) key means a re-tick just recreates
    // the row, and keeping dead rows around would make `active` ambiguous.
    prisma.bookableService.deleteMany({
      where: { bookingPageId: bookingPage.id, serviceId: { notIn: selectedIds.length ? selectedIds : ['__none__'] } },
    }),
    ...selectedIds.map((serviceId, position) =>
      prisma.bookableService.upsert({
        where: { bookingPageId_serviceId: { bookingPageId: bookingPage.id, serviceId } },
        create: { bookingPageId: bookingPage.id, serviceId, businessId, position, active: true },
        update: { position, active: true },
      })
    ),
  ]);

  revalidatePath('/settings/booking');
  revalidatePath(`/book/${slug}`);
  return { ok: true };
}
