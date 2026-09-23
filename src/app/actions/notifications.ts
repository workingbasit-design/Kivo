'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth';
import {
  markAllNotificationsRead as markAllRead,
  markNotificationRead as markOneRead,
  saveNotificationSettings,
  parseSettings,
  NOTIFICATION_TYPES,
  type NotificationSettings,
} from '@/lib/notifications';

/** Mark every notification in this business as read. Tenant-scoped. */
export async function markAllNotificationsRead(): Promise<void> {
  const { businessId } = await requireAuth();
  await markAllRead(businessId);
  revalidatePath('/notifications');
}

/** Mark one notification as read. Tenant-scoped (id + businessId). */
export async function markNotificationRead(id: string): Promise<void> {
  const { businessId } = await requireAuth();
  if (typeof id !== 'string' || id.length === 0 || id.length > 64) return;
  await markOneRead(id, businessId);
  revalidatePath('/notifications');
}

/**
 * Save per-type notification preferences. Unchecked boxes submit nothing, so
 * every type is read explicitly (missing = off). Unknown keys are ignored —
 * only the six known types can ever be stored.
 */
export async function saveNotificationSettingsAction(
  formData: FormData
): Promise<{ ok: boolean }> {
  const { businessId } = await requireAuth();
  const base = parseSettings(null); // all on; we then apply the posted values
  const next: NotificationSettings = { ...base };
  for (const key of NOTIFICATION_TYPES) {
    // Checkbox posts "on" when checked, absent when unchecked.
    next[key] = formData.get(`notify_${key}`) === 'on';
  }
  await saveNotificationSettings(businessId, next);
  revalidatePath('/settings');
  revalidatePath('/notifications');
  return { ok: true };
}
