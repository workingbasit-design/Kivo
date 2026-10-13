'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

export type BrandKitResult = { ok?: boolean; error?: string };

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_TAGLINE = 140;
const MAX_SERVICES = 10;
const MAX_SERVICE_LEN = 60;

/** Save the business's brand kit (tenant-scoped). Never touches other tenants. */
export async function saveBrandKit(
  tagline: string,
  primary: string,
  accent: string,
  services: string[]
): Promise<BrandKitResult> {
  const { businessId, user } = await requireAuth();
  const rl = rateLimit(`brand:${user.id}`, ACTION_LIMIT);
  if (!rl.ok) {
    const locale = await getLocale();
    return { error: t(locale, 'track8.rateLimited') };
  }

  const cleanTagline = tagline.trim().slice(0, MAX_TAGLINE) || null;
  const cleanPrimary = HEX_RE.test(primary.trim()) ? primary.trim() : null;
  const cleanAccent = HEX_RE.test(accent.trim()) ? accent.trim() : null;
  const cleanServices = services
    .map((s) => s.trim().slice(0, MAX_SERVICE_LEN))
    .filter(Boolean)
    .slice(0, MAX_SERVICES);

  await prisma.business.update({
    where: { id: businessId },
    data: {
      tagline: cleanTagline,
      brandColors:
        cleanPrimary || cleanAccent
          ? JSON.stringify({
              primary: cleanPrimary ?? '#3f6212',
              accent: cleanAccent ?? '#a3e635',
            })
          : null,
      brandServices: cleanServices.length > 0 ? JSON.stringify(cleanServices) : null,
    },
  });

  revalidatePath('/marketing/brand');
  return { ok: true };
}
