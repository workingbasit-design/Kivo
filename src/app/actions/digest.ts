'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

export type DigestSettingsResult = { ok?: boolean; error?: string };

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Create or update the business's morning-digest preferences (tenant-scoped). */
export async function saveDigestSettings(
  enabled: boolean,
  sendTime: string,
  channels: string[]
): Promise<DigestSettingsResult> {
  const { businessId, user } = await requireAuth();
  const rl = rateLimit(`digest:${user.id}`, ACTION_LIMIT);
  if (!rl.ok) {
    const locale = await getLocale();
    return { error: t(locale, 'track8.rateLimited') };
  }

  const cleanTime = TIME_RE.test(sendTime) ? sendTime : '07:00';
  const cleanChannels = channels
    .filter((c) => c === 'IN_APP' || c === 'PUSH')
    .join(',');
  const channelStr = cleanChannels || 'IN_APP';

  await prisma.digestSetting.upsert({
    where: { businessId },
    create: { businessId, enabled, sendTime: cleanTime, channels: channelStr },
    update: { enabled, sendTime: cleanTime, channels: channelStr },
  });

  revalidatePath('/digest');
  return { ok: true };
}
