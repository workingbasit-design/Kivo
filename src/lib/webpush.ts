/**
 * Web Push sender (VAPID) — server only.
 *
 * Zero-cost push notifications: the browser's own push service delivers them,
 * no paid provider involved. All functions degrade gracefully when the VAPID
 * env vars are missing: sends become no-ops and the UI shows a friendly
 * "not configured" state instead of crashing.
 *
 * Env vars (all three required):
 *   VAPID_PUBLIC_KEY   base64url public key  (exposed to browsers)
 *   VAPID_PRIVATE_KEY  base64url private key (server only — never ship to client)
 *   VAPID_SUBJECT      "mailto:you@example.com" or an https URL identifying the sender
 *
 * Generate a pair locally (free):  npx web-push generate-vapid-keys
 */
import webpush from 'web-push';

export interface PushKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Deep-link path inside the app, e.g. "/jobs/abc". Must start with "/". */
  url?: string;
  icon?: string;
  tag?: string;
}

export type PushSendResult =
  | { ok: true }
  | { ok: false; skipped: true; reason: 'push-not-configured' }
  | { ok: false; expired: true; reason: 'subscription-expired' }
  | { ok: false; reason: string };

/** True when all three VAPID env vars are present and non-empty. */
export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim() &&
      process.env.VAPID_SUBJECT?.trim()
  );
}

/** The public VAPID key browsers need to subscribe, or null when unconfigured. */
export function getVapidPublicKey(): string | null {
  const key = process.env.VAPID_PUBLIC_KEY?.trim();
  return key ? key : null;
}

/**
 * Build the JSON payload the service worker's `push` handler expects.
 * Pure function — safe to unit test, no network.
 */
export function buildPushPayload(p: PushPayload): string {
  // Only same-app paths. Reject protocol-relative ("//evil.example") too —
  // the service worker would otherwise navigate the user off-site.
  const url = p.url && p.url.startsWith('/') && !p.url.startsWith('//') ? p.url : '/dashboard';
  return JSON.stringify({
    title: p.title,
    body: p.body,
    url,
    icon: p.icon ?? '/icons/icon-192.png',
    tag: p.tag ?? 'everyjob',
  });
}

let vapidReady = false;

function ensureVapid(): boolean {
  if (vapidReady) return true;
  if (!isPushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!.trim(),
    process.env.VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim()
  );
  vapidReady = true;
  return true;
}

/** Test-only escape hatch: reset the cached VAPID setup between cases. */
export function __resetVapidForTests(): void {
  vapidReady = false;
}

/**
 * Send one push notification. Never throws: every failure mode is returned
 * as data. `expired: true` means the subscription is dead (410/404 from the
 * push service) and the caller should delete it.
 */
export async function sendPushNotification(  sub: PushKeys,
  payload: PushPayload
): Promise<PushSendResult> {
  if (!ensureVapid()) {
    return { ok: false, skipped: true, reason: 'push-not-configured' };
  }
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      buildPushPayload(payload)
    );
    return { ok: true };
  } catch (err: unknown) {
    const status =
      typeof err === 'object' && err !== null && 'statusCode' in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    if (status === 404 || status === 410) {
      return { ok: false, expired: true, reason: 'subscription-expired' };
    }
    const message = err instanceof Error ? err.message : 'send-failed';
    return { ok: false, reason: message };
  }
}

/**
 * Fan-out helper: push to every subscribed device of a business, pruning
 * dead subscriptions. Never throws — push is best-effort and must never
 * fail the business operation that triggered it.
 *
 * Copy is concise bilingual (EN/FR) because a device's language preference
 * isn't stored server-side.
 */
export async function pushToBusiness(
  businessId: string,
  payload: PushPayload
): Promise<{ sent: number; pruned: number }> {
  const out = { sent: 0, pruned: 0 };
  if (!isPushConfigured()) return out;
  try {
    const { prisma } = await import('@/lib/prisma');
    const subs = await prisma.pushSubscription.findMany({
      where: { businessId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    for (const s of subs) {
      const r = await sendPushNotification(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        payload
      );
      if (r.ok) out.sent++;
      else if ('expired' in r && r.expired) {
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
        out.pruned++;
      }
    }
  } catch (err) {
    console.error('[push] fan-out failed', err);
  }
  return out;
}
