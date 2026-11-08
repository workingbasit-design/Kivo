import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/slug';
import { unsafeUnscoped } from '@/lib/tenant-guard';

/**
 * Create the business's public booking page (slug from the business name,
 * enabled) if it does not exist yet.
 *
 * Registration is the first place this must happen: without a record,
 * /book/<slug> 404s even though the booking settings form defaults the
 * toggle ON and the settings page auto-creates the record on a name change
 * (2026-11-08 deep test: a fresh business's booking link was dead until
 * the owner opened Settings > Booking and pressed Save).
 *
 * Best-effort at signup: a failure here must never fail registration.
 * Callers that need the page to exist (registration) wrap this in try/catch.
 */
export async function ensureBookingPage(businessId: string, businessName: string): Promise<void> {
  const existing = await prisma.bookingPage.findUnique({
    where: { businessId },
    select: { id: true },
  });
  if (existing) return;

  const base = slugify(businessName);
  let slug = base;
  for (let i = 2; i <= 20; i++) {
    // Global slug uniqueness: slugs live in the public /book/[slug] URL
    // namespace, so the clash check must span all businesses.
    const clash = await unsafeUnscoped('booking-page:slugClashCheck', (db) =>
      db.bookingPage.findUnique({ where: { slug }, select: { id: true } })
    );
    if (!clash) break;
    slug = `${base}-${i}`;
  }

  await prisma.bookingPage.create({
    data: { businessId, slug, enabled: true },
  });
}
