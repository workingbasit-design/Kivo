'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { DASHBOARD_SECTIONS, isDashboardSectionKey } from '@/lib/dashboard-layout';

const sectionSchema = z.object({
  key: z.string().refine(isDashboardSectionKey, 'Unknown dashboard section'),
  visible: z.boolean(),
});

/**
 * Part C (dashboard rebuild): save "Customize this screen".
 * Any signed-in member may save their own layout; the row is keyed by
 * (userId, businessId) so one user's choices never affect another's.
 */
export async function saveDashboardLayout(
  sections: { key: string; visible: boolean }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user, businessId } = await requireAuth();
  const parsed = z.array(sectionSchema).min(1).max(DASHBOARD_SECTIONS.length).safeParse(sections);
  if (!parsed.success) {
    return { ok: false, error: 'That layout could not be saved. Please try again.' };
  }
  // De-dupe by key, keeping the first occurrence (the visible order).
  const seen = new Set<string>();
  const clean = parsed.data.filter((s) => {
    if (seen.has(s.key)) return false;
    seen.add(s.key);
    return true;
  });
  await prisma.dashboardLayout.upsert({
    where: { userId_businessId: { userId: user.id, businessId } },
    update: { sections: JSON.stringify(clean) },
    create: { userId: user.id, businessId, sections: JSON.stringify(clean) },
  });
  return { ok: true };
}
