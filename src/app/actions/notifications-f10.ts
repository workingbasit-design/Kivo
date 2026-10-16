'use server';

import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import {
  listNotificationsFor,
  getUnreadCountFor,
  renderF10Title,
  renderF10Body,
} from '@/lib/f10-notify';

export interface BellSummaryItem {
  id: string;
  type: string;
  href: string | null;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

/**
 * F10: bell dropdown data — unread count + the 8 most recent notifications
 * visible to the current user (technicians only see business-wide + their
 * own). Tenant-scoped; never throws for a logged-in member.
 */
export async function getNotificationSummary(): Promise<{
  unreadCount: number;
  recent: BellSummaryItem[];
}> {
  const { businessId, user, role } = await requireAuth();
  const locale = await getLocale();

  // Technicians see business-wide + their own; everyone else sees everything.
  const techScoped = role === 'TECHNICIAN' ? user.id : undefined;
  const [unreadCount, recent] = await Promise.all([
    getUnreadCountFor(businessId, techScoped),
    listNotificationsFor(businessId, techScoped, 8),
  ]);
  return {
    unreadCount,
    recent: recent.map((n) => ({
      id: n.id,
      type: n.type,
      href: n.href,
      title: renderF10Title(n.type, n.data, locale),
      body: renderF10Body(n.type, n.data, locale),
      createdAt: n.createdAt.toISOString(),
      read: !!n.readAt,
    })),
  };
}
