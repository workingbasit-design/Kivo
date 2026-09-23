'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { isDirectoryAdminEmail } from '@/lib/directory';
import { serviceAreasToJson } from '@/lib/directory-claim';

export type DirectoryProfileResult = { ok?: boolean; error?: string };

async function checkLimit(userId: string): Promise<DirectoryProfileResult | null> {
  const rl = rateLimit(`dir-profile:${userId}`, ACTION_LIMIT);
  if (!rl.ok) return { error: 'Too many requests. Please wait a moment and try again.' };
  return null;
}

/**
 * One-time consent migration. Businesses whose listing was already public
 * via the app (account holder = owner, opted in before verification existed)
 * get an APPROVED claim so they are not unpublished by the new flow.
 * Never auto-approves NEW requests — those always wait for an admin.
 */
export async function ensureClaimState(businessId: string): Promise<void> {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { directoryOptIn: true, directoryVerifiedAt: true },
  });
  if (!biz || !biz.directoryOptIn || biz.directoryVerifiedAt) return;
  const [claim, page] = await Promise.all([
    prisma.directoryClaim.findUnique({ where: { businessId }, select: { id: true } }),
    prisma.bookingPage.findUnique({ where: { businessId }, select: { id: true } }),
  ]);
  if (claim || !page) return;
  await prisma.$transaction([
    prisma.directoryClaim.create({
      data: {
        businessId,
        status: 'APPROVED',
        decidedBy: 'system',
        decidedAt: new Date(),
        note: 'Grandfathered: listing was already public via the app before claim verification was introduced.',
      },
    }),
    prisma.business.update({
      where: { id: businessId },
      data: { directoryVerifiedAt: new Date() },
    }),
  ]);
}

/**
 * Business requests verification of its directory listing. Creates a PENDING
 * claim — the listing stays unpublished until an admin explicitly approves.
 * No auto-approval, nothing sent anywhere.
 */
export async function requestDirectoryClaim(formData: FormData): Promise<void> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return;

  const note = String(formData.get('note') ?? '').trim().slice(0, 500) || null;

  const existing = await prisma.directoryClaim.findUnique({ where: { businessId } });
  if (existing?.status === 'PENDING') return; // idempotent: already waiting

  await prisma.$transaction([
    prisma.directoryClaim.upsert({
      where: { businessId },
      create: { businessId, status: 'PENDING', note },
      update: { status: 'PENDING', note, decidedBy: null, decidedAt: null },
    }),
    prisma.business.update({
      where: { id: businessId },
      data: { directoryOptIn: true, directoryVerifiedAt: null },
    }),
  ]);

  revalidatePath('/directory-profile');
}

const profileSchema = z.object({
  headline: z.string().trim().max(120).optional().default(''),
  headlineFr: z.string().trim().max(120).optional().default(''),
  intro: z.string().trim().max(500).optional().default(''),
  introFr: z.string().trim().max(500).optional().default(''),
  description: z.string().trim().max(2000).optional().default(''),
  descriptionFr: z.string().trim().max(2000).optional().default(''),
  // Free-text input ("Toronto, Scarborough") stored as a JSON array.
  serviceAreas: z.string().trim().max(500).optional().default(''),
  showPhone: z.coerce.boolean().default(true),
  enabled: z.coerce.boolean().default(true),
});

function nullIfEmpty(v: string): string | null {
  return v === '' ? null : v;
}

/** Create/update the business's public directory profile (tenant-scoped). */
export async function updateDirectoryProfile(
  _prev: DirectoryProfileResult,
  formData: FormData
): Promise<DirectoryProfileResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const parsed = profileSchema.safeParse({
    headline: formData.get('headline'),
    headlineFr: formData.get('headlineFr'),
    intro: formData.get('intro'),
    introFr: formData.get('introFr'),
    description: formData.get('description'),
    descriptionFr: formData.get('descriptionFr'),
    serviceAreas: formData.get('serviceAreas'),
    showPhone: formData.get('showPhone'),
    enabled: formData.get('enabled'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }
  const d = parsed.data;

  const areasJson = serviceAreasToJson(d.serviceAreas);

  // Ensure a booking page exists so the profile has a stable public link.
  let page = await prisma.bookingPage.findUnique({ where: { businessId }, select: { id: true } });
  if (!page) {
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    });
    const { slugify } = await import('@/lib/slug');
    let slug = slugify(biz?.name ?? 'business');
    for (let i = 2; i <= 20; i++) {
      const clash = await prisma.bookingPage.findUnique({ where: { slug }, select: { id: true } });
      if (!clash) break;
      slug = `${slugify(biz?.name ?? 'business')}-${i}`;
    }
    page = await prisma.bookingPage.create({
      data: { businessId, slug, enabled: d.enabled },
      select: { id: true },
    });
  }

  await prisma.bookingPage.update({
    where: { businessId },
    data: {
      headline: nullIfEmpty(d.headline),
      headlineFr: nullIfEmpty(d.headlineFr),
      intro: nullIfEmpty(d.intro),
      introFr: nullIfEmpty(d.introFr),
      description: nullIfEmpty(d.description),
      descriptionFr: nullIfEmpty(d.descriptionFr),
      serviceAreas: areasJson,
      showPhone: d.showPhone,
      enabled: d.enabled,
    },
  });

  revalidatePath('/directory-profile');
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Admin (KIVO_ADMIN_EMAILS): explicit approve / reject                 */
/* ------------------------------------------------------------------ */

async function requireDirectoryAdmin(): Promise<{ email: string } | { error: string }> {
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  const email = session?.user?.email;
  if (!isDirectoryAdminEmail(email)) return { error: 'Not authorized.' };
  return { email: email! };
}

/** Admin approves a claim: the listing goes public. */
export async function approveDirectoryClaim(claimId: string): Promise<DirectoryProfileResult> {
  const admin = await requireDirectoryAdmin();
  if ('error' in admin) return admin;

  const claim = await prisma.directoryClaim.findUnique({
    where: { id: claimId },
    select: { id: true, businessId: true, status: true },
  });
  if (!claim) return { error: 'Claim not found.' };
  if (claim.status === 'APPROVED') return { error: 'Claim is already approved.' };

  await prisma.$transaction([
    prisma.directoryClaim.update({
      where: { id: claimId },
      data: { status: 'APPROVED', decidedBy: admin.email, decidedAt: new Date() },
    }),
    prisma.business.update({
      where: { id: claim.businessId },
      data: { directoryVerifiedAt: new Date(), directoryOptIn: true },
    }),
  ]);

  revalidatePath('/directory-claims');
  return { ok: true };
}

/** Admin rejects a claim: the listing stays unpublished. Nothing is sent. */
export async function rejectDirectoryClaim(
  _prev: DirectoryProfileResult,
  formData: FormData
): Promise<DirectoryProfileResult> {
  const admin = await requireDirectoryAdmin();
  if ('error' in admin) return admin;

  const claimId = String(formData.get('claimId') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 500) || null;

  const claim = await prisma.directoryClaim.findUnique({
    where: { id: claimId },
    select: { id: true, businessId: true, status: true },
  });
  if (!claim) return { error: 'Claim not found.' };

  await prisma.$transaction([
    prisma.directoryClaim.update({
      where: { id: claimId },
      data: { status: 'REJECTED', decidedBy: admin.email, decidedAt: new Date(), note },
    }),
    prisma.business.update({
      where: { id: claim.businessId },
      data: { directoryOptIn: false, directoryVerifiedAt: null },
    }),
  ]);

  revalidatePath('/directory-claims');
  return { ok: true };
}
