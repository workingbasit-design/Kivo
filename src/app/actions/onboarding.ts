'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { onboardingSchema } from '@/lib/validations';

export type OnboardingResult = { error?: string; ok?: boolean };

async function checkLimit(userId: string): Promise<OnboardingResult | null> {
  const rl = rateLimit(`onboarding:${userId}`, ACTION_LIMIT);
  if (!rl.ok) {
    return { error: 'Too many requests. Please wait a moment and try again.' };
  }
  return null;
}

/**
 * Save the 3-question first-run answers. Tenant-scoped via requireAuth.
 * Sets onboardingDone so the flow never shows again.
 */
export async function saveOnboarding(
  _prev: OnboardingResult,
  formData: FormData
): Promise<OnboardingResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const parsed = onboardingSchema.safeParse({
    trade: formData.get('trade'),
    teamSize: formData.get('teamSize'),
    province: formData.get('province'),
  });
  if (!parsed.success) {
    return { error: 'Please answer all three questions.' };
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      trade: parsed.data.trade,
      teamSize: parsed.data.teamSize,
      taxRegion: parsed.data.province,
      onboardingDone: true,
    },
  });
  redirect('/dashboard');
}

/** Skip first run (standing rule: never force completion). Still marks done. */
export async function skipOnboarding(): Promise<void> {
  const { businessId } = await requireAuth();
  await prisma.business.update({
    where: { id: businessId },
    data: { onboardingDone: true },
  });
  redirect('/dashboard');
}
