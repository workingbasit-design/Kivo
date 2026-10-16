/**
 * F10: event-driven notifications + per-user visibility.
 *
 * Self-contained module (separate from ./notifications.ts, which owns the
 * periodic sync builders) so F10's new capabilities ship behind the
 * per-business `notifications` feature flag without touching shared code.
 *
 * Unlike syncNotifications (periodic scans), notifyEvent() is called at the
 * moment an event happens (lead created, quote accepted/declined, payment
 * recorded, booking received). It is idempotent via the
 * (businessId, dedupeKey) unique constraint, and it respects the business's
 * notification preferences AND the F10 feature flag at creation time — a
 * disabled type or a disabled flag means no row is ever written.
 *
 * In-app ONLY. Nothing here sends WhatsApp, SMS, email, or any other
 * external message — it only writes Notification rows.
 */
import { prisma } from '@/lib/prisma';
import { parseSettings } from './notification-prefs.ts';
import { parseFlags, isFlagOn } from './feature-flags.ts';
import { t, type Locale } from '@/lib/i18n/index';

/**
 * F10 feature-flag key (per-business, stored on Business.featureFlags).
 * Gates: event-driven notifications (notifyEvent) + global record search.
 * The pre-existing sync-based notification center is NOT gated.
 */
export const FLAG_NOTIFICATIONS = 'notifications';

/** F10 event types (subset of the notification type registry). */
export const F10_EVENT_TYPES = [
  'lead_new',
  'quote_accepted',
  'quote_declined',
  'change_requested',
  'booking_new',
  'booking_request', // F7: customer booking request submitted (approval workflow)
  'payment_recorded',
] as const;
export type F10EventType = (typeof F10_EVENT_TYPES)[number];

export type F10EntityType = 'LEAD' | 'QUOTE' | 'INVOICE' | 'PAYMENT' | 'JOB' | 'BOOKING';

export interface F10EventNotification {
  /** Event type; checked against the business's notification preferences. */
  type: string;
  /** Stable per (business, type, source record) — dedupes retries/double-taps. */
  dedupeKey: string;
  href: string | null;
  data: Record<string, string>;
  entityType?: F10EntityType;
  entityId?: string;
  /** When set, only this user sees the notification (technician-scoped). */
  userId?: string;
}

export interface F10ListedNotification {
  id: string;
  type: string;
  href: string | null;
  data: Record<string, string>;
  readAt: Date | null;
  createdAt: Date;
}

function parseData(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(p)) out[k] = String(v ?? '');
    return out;
  } catch {
    return {};
  }
}

/** Fill a "{param}" template. Missing params render as "". */
function fill(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? '');
}

/** Locale-aware title for an event notification (rendered at read time). */
export function renderF10Title(type: string, data: Record<string, string>, locale: Locale): string {
  return fill(t(locale, `notifications.t_${type}`), data);
}

/** Locale-aware body for an event notification (rendered at read time). */
export function renderF10Body(type: string, data: Record<string, string>, locale: Locale): string {
  return fill(t(locale, `notifications.b_${type}`), data);
}

/**
 * Fire an event-driven notification. Returns true when a row was created.
 *
 * Fail-closed on the flag (flag off => nothing created). Preferences are
 * parsed with parseSettings (unknown/missing keys default ON), and a type
 * explicitly disabled in settings is never written.
 */
export async function notifyEvent(
  businessId: string,
  event: F10EventNotification
): Promise<boolean> {
  if (!businessId || !event.type || !event.dedupeKey) return false;
  if (event.dedupeKey.length > 191) return false;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { notificationSettings: true, featureFlags: true },
  });
  if (!business) return false;

  // F10 feature flag: event notifications are gated per business.
  if (!isFlagOn(parseFlags(business.featureFlags), FLAG_NOTIFICATIONS)) return false;

  // Preferences respected at creation time: a disabled kind is never written.
  // New F10 types absent from a saved settings blob default ON (same as the
  // sync path's parseSettings semantics).
  const settings = parseSettings(business.notificationSettings) as Record<string, boolean>;
  if (settings[event.type] === false) return false;

  try {
    await prisma.notification.create({
      data: {
        businessId,
        type: event.type,
        data: JSON.stringify(event.data),
        href: event.href,
        dedupeKey: event.dedupeKey,
      },
    });
    return true;
  } catch {
    // Unique violation on (businessId, dedupeKey): already notified.
    return false;
  }
}

/**
 * List notifications visible to a user. When userId is set (technicians),
 * only business-wide (userId NULL) and personally-addressed rows are
 * returned; otherwise the whole business inbox is returned.
 */
export async function listNotificationsFor(
  businessId: string,
  userId: string | undefined,
  limit = 100
): Promise<F10ListedNotification[]> {
  const rows = await prisma.notification.findMany({
    where: { businessId },
    orderBy: [{ readAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    href: r.href,
    data: parseData(r.data),
    readAt: r.readAt,
    createdAt: r.createdAt,
  }));
}

/** Unread count for a user (same visibility rule as listNotificationsFor). */
export async function getUnreadCountFor(
  businessId: string,
  userId: string | undefined
): Promise<number> {
  return prisma.notification.count({
    where: { businessId, readAt: null },
  });
}
