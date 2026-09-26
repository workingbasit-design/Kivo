'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import {
  googleOAuthConfigured,
  googleScopes,
  refreshAccessToken,
  fetchGoogleAccounts,
  fetchGoogleLocations,
  fetchAllGoogleReviews,
  mapGoogleReview,
  dedupeNewReviews,
  revokeGoogleToken,
  type GoogleErrorKind,
} from '@/lib/google-reviews';

export type GoogleStatus = {
  configured: boolean;
  connected: boolean;
  hasLocation: boolean;
  locationName: string | null;
  lastSyncAt: string | null;
  googleAccountId: string | null;
};

export type GoogleActionResult = {
  ok?: boolean;
  error?: string;
  errorKind?: GoogleErrorKind;
  imported?: number;
  skipped?: number;
  locations?: { locationId: string; title: string }[];
};

function googleEnv(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function checkLimit(userId: string): Promise<GoogleActionResult | null> {
  const rl = rateLimit(`google:${userId}`, ACTION_LIMIT);
  if (!rl.ok) return { error: 'Too many requests. Please wait a moment and try again.' };
  return null;
}

/** Connection status for the current business (tenant-scoped). */
export async function getGoogleStatus(): Promise<GoogleStatus> {
  const { businessId } = await requireAuth();
  const conn = await prisma.googleConnection.findUnique({
    where: { businessId },
    select: { locationId: true, locationName: true, lastSyncAt: true, googleAccountId: true },
  });
  return {
    configured: googleOAuthConfigured(),
    connected: !!conn,
    hasLocation: !!conn?.locationId,
    locationName: conn?.locationName ?? null,
    lastSyncAt: conn?.lastSyncAt ? conn.lastSyncAt.toISOString() : null,
    googleAccountId: conn?.googleAccountId ?? null,
  };
}

/**
 * Load a usable access token for this business's Google connection,
 * refreshing it when expired. Throws a classified error on failure.
 */
async function getValidAccessToken(businessId: string): Promise<{ token: string; connId: string }> {
  const env = googleEnv();
  if (!env) throw Object.assign(new Error('Not configured'), { kind: 'config' as GoogleErrorKind });
  const conn = await prisma.googleConnection.findUnique({ where: { businessId } });
  if (!conn) throw Object.assign(new Error('Not connected'), { kind: 'reauth' as GoogleErrorKind });

  const stillValid = conn.expiresAt && conn.expiresAt.getTime() > Date.now() + 60_000;
  if (stillValid) return { token: conn.accessToken, connId: conn.id };

  if (!conn.refreshToken) {
    throw Object.assign(new Error('No refresh token'), { kind: 'reauth' as GoogleErrorKind });
  }
  const refreshed = await refreshAccessToken(
    { clientId: env.clientId, clientSecret: env.clientSecret, refreshToken: conn.refreshToken },
    fetch
  );
  await prisma.googleConnection.update({
    where: { id: conn.id, businessId },
    data: { accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt },
  });
  return { token: refreshed.accessToken, connId: conn.id };
}

/** List the user's Google Business locations (all accounts) for the picker. */
export async function listGoogleLocations(): Promise<GoogleActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  try {
    const { token } = await getValidAccessToken(businessId);
    const accounts = await fetchGoogleAccounts(token, fetch);
    const locations: { locationId: string; title: string }[] = [];
    for (const a of accounts) {
      const locs = await fetchGoogleLocations(token, a.accountId, fetch);
      for (const l of locs) locations.push({ locationId: l.locationId, title: l.title });
    }
    return { ok: true, locations };
  } catch (e) {
    const kind = (e as { kind?: GoogleErrorKind }).kind ?? 'unknown';
    return { errorKind: kind, error: 'Could not load your Google business locations.' };
  }
}

/** Save the business's chosen Google location. Tenant-scoped. */
export async function selectGoogleLocation(
  _prev: GoogleActionResult,
  formData: FormData
): Promise<GoogleActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const locationId = String(formData.get('locationId') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim().slice(0, 200);
  if (!locationId) return { error: 'Please choose a location.' };

  // Verify the location actually belongs to this Google user before saving.
  const check = await listGoogleLocations();
  if (!check.ok || !check.locations?.some((l) => l.locationId === locationId)) {
    return { error: 'That location could not be verified with Google. Please try again.' };
  }

  const conn = await prisma.googleConnection.findUnique({
    where: { businessId },
    select: { id: true, googleAccountId: true },
  });
  if (!conn) return { errorKind: 'reauth', error: 'Google is not connected.' };

  await prisma.googleConnection.update({
    where: { id: conn.id, businessId },
    data: { locationId, locationName: title || null },
  });

  revalidatePath('/reviews');
  return { ok: true };
}

/**
 * One-tap Google review sync. Explicit user action only — no background sync.
 * Imports new reviews, dedupes by externalId, never touches manual reviews.
 */
export async function syncGoogleReviews(): Promise<GoogleActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  try {
    const { token, connId } = await getValidAccessToken(businessId);
    const conn = await prisma.googleConnection.findUnique({
      where: { id: connId, businessId },
      select: { googleAccountId: true, locationId: true },
    });
    if (!conn?.googleAccountId || !conn?.locationId) {
      return { error: 'Please choose your Google business location first.' };
    }

    const fetched = await fetchAllGoogleReviews(
      { accessToken: token, accountId: conn.googleAccountId, locationId: conn.locationId },
      fetch
    );
    const mapped = fetched.map(mapGoogleReview).filter((r) => r !== null);

    const existing = await prisma.review.findMany({
      where: { businessId, externalId: { not: null } },
      select: { externalId: true },
    });
    const toImport = dedupeNewReviews(new Set(existing.map((e) => e.externalId!)), mapped);

    if (toImport.length > 0) {
      await prisma.review.createMany({
        data: toImport.map((r) => ({
          businessId,
          rating: r.rating,
          comment: r.comment,
          source: 'Google',
          externalId: r.externalId,
          reviewerName: r.reviewerName,
          reviewedAt: r.reviewedAt,
        })),
      });
    }

    await prisma.googleConnection.update({
      where: { id: connId, businessId },
      data: { lastSyncAt: new Date() },
    });

    revalidatePath('/reviews');
    return { ok: true, imported: toImport.length, skipped: mapped.length - toImport.length };
  } catch (e) {
    const kind = (e as { kind?: GoogleErrorKind }).kind ?? 'unknown';
    return { errorKind: kind, error: 'Google review sync failed.' };
  }
}

/** Disconnect: revoke tokens at Google and delete the local connection. */
export async function disconnectGoogle(): Promise<GoogleActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const conn = await prisma.googleConnection.findUnique({ where: { businessId } });
  if (!conn) return { ok: true };

  // Best-effort revocation; local deletion always happens.
  await revokeGoogleToken(conn.accessToken, fetch);
  if (conn.refreshToken) await revokeGoogleToken(conn.refreshToken, fetch);
  await prisma.googleConnection.delete({ where: { id: conn.id, businessId } });

  revalidatePath('/reviews');
  return { ok: true };
}

/** Scopes the connect route requests (kept in one place for Track 6 reuse). */
export async function getGoogleConnectScopes(): Promise<string[]> {
  await requireAuth();
  return googleScopes();
}
