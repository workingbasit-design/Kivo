/**
 * Client-safe notification preferences: types, type list, and pure
 * parse/serialize helpers.
 *
 * This module intentionally has NO server-only imports (no Prisma, no
 * tenant-guard). It is imported directly by client components
 * (NotificationSettingsForm), so adding a server-only import here will
 * break the production build (Turbopack cannot place node: builtins in a
 * browser chunk). Server-side notification generation lives in
 * ./notifications.ts, which re-exports everything here.
 */

export const NOTIFICATION_TYPES = [
  'job_tomorrow',
  'job_soon',
  'invoice_overdue',
  'quote_expiring',
  'booking_new',
  'payment_recorded',
  'messaging_quota',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationSettings = Record<NotificationType, boolean>;

export function defaultSettings(): NotificationSettings {
  return {
    job_tomorrow: true,
    job_soon: true,
    invoice_overdue: true,
    quote_expiring: true,
    booking_new: true,
    payment_recorded: true,
    messaging_quota: true,
  };
}

/** Parse the Business.notificationSettings JSON; unknown/missing keys default ON. */
export function parseSettings(raw: string | null | undefined): NotificationSettings {
  const out = defaultSettings();
  if (!raw) return out;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<NotificationType, unknown>>;
    for (const key of NOTIFICATION_TYPES) {
      if (typeof parsed[key] === 'boolean') out[key] = parsed[key];
    }
  } catch {
    // Corrupt JSON -> safe default: everything on.
  }
  return out;
}

export function serializeSettings(s: NotificationSettings): string {
  const out: Record<string, boolean> = {};
  for (const key of NOTIFICATION_TYPES) out[key] = !!s[key];
  return JSON.stringify(out);
}
