/**
 * Pure Google Business Profile helpers (Track 5).
 *
 * No Next.js imports — runs under plain node:test. HTTP is injected so
 * tests use mocked fetch; the server actions pass the real fetch.
 *
 * Verified against Google's docs (2026-09-23):
 * - Reviews list: GET https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews
 *   (v4.9 legacy endpoint — reviews were NOT migrated to the federated v1 APIs)
 * - Accounts: GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts
 * - Locations: GET https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{accountId}/locations
 * - OAuth: user consent only (no service accounts), scope
 *   https://www.googleapis.com/auth/business.manage
 */

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const GOOGLE_ACCOUNT_MGMT_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
export const GOOGLE_BUSINESS_INFO_URL = 'https://mybusinessbusinessinformation.googleapis.com/v1';
export const GOOGLE_REVIEWS_URL = 'https://mybusiness.googleapis.com/v4';

export const SCOPE_BUSINESS_MANAGE = 'https://www.googleapis.com/auth/business.manage';
/** Extra scope for the Track 6 calendar import; requested together at connect time. */
export const SCOPE_CALENDAR_READONLY = 'https://www.googleapis.com/auth/calendar.readonly';

/** Scopes requested when a business connects Google. Extend here, not ad hoc. */
export function googleScopes(): string[] {
  // Calendar readonly is included from Track 6 so calendar import never needs
  // a second consent screen. Connections made before Track 6 lack it — the
  // calendar import action detects the missing scope and asks to reconnect.
  return [SCOPE_BUSINESS_MANAGE, SCOPE_CALENDAR_READONLY];
}

export function googleOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/google/callback`;
}

export function buildAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}): string {
  const p = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: opts.scopes.join(' '),
    access_type: 'offline', // get a refresh token
    prompt: 'consent', // force refresh token on every connect
    state: opts.state,
  });
  return `${GOOGLE_AUTH_URL}?${p.toString()}`;
}

/* ------------------------------------------------------------------ */
/* Review mapping                                                       */
/* ------------------------------------------------------------------ */

export type GoogleApiReview = {
  name?: string; // accounts/{a}/locations/{l}/reviews/{r}
  reviewId?: string;
  reviewer?: { displayName?: string; isAnonymous?: boolean };
  starRating?: string; // ONE | TWO | THREE | FOUR | FIVE
  comment?: string;
  createTime?: string;
  updateTime?: string;
};

export type MappedReview = {
  externalId: string;
  rating: number;
  comment: string | null;
  reviewerName: string | null;
  reviewedAt: Date | null;
};

const STAR_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

/** Google's STAR_RATING enum → 1-5. Null when missing/unrecognized (skipped, never guessed). */
export function starRatingToInt(starRating: string | null | undefined): number | null {
  if (!starRating) return null;
  return STAR_MAP[starRating] ?? null;
}

/**
 * Map one Google review to our Review row shape. Returns null when the
 * review has no usable id or rating — we never invent either.
 */
export function mapGoogleReview(g: GoogleApiReview): MappedReview | null {
  const externalId = (g.name ?? '').trim();
  const rating = starRatingToInt(g.starRating);
  if (!externalId || rating === null) return null;
  const reviewerName =
    g.reviewer?.isAnonymous || !g.reviewer?.displayName?.trim()
      ? null
      : g.reviewer.displayName.trim();
  let reviewedAt: Date | null = null;
  if (g.createTime) {
    const d = new Date(g.createTime);
    if (!Number.isNaN(d.getTime())) reviewedAt = d;
  }
  return {
    externalId,
    rating,
    comment: g.comment?.trim() || null,
    reviewerName,
    reviewedAt,
  };
}

/**
 * Dedupe fetched reviews against the externalIds already stored for this
 * business. Manual reviews (externalId null) are never touched.
 */
export function dedupeNewReviews(
  existingExternalIds: Set<string>,
  fetched: MappedReview[]
): MappedReview[] {
  return fetched.filter((r) => !existingExternalIds.has(r.externalId));
}

/* ------------------------------------------------------------------ */
/* Error classification (user-friendly, EN/FR)                          */
/* ------------------------------------------------------------------ */

export type GoogleErrorKind =
  | 'reauth' // 401: token expired/revoked → reconnect
  | 'forbidden' // 403: no access to the location, or API not enabled/approved
  | 'not_found' // 404
  | 'rate_limited' // 429
  | 'config' // our env missing
  | 'unknown';

export function classifyGoogleError(status: number): GoogleErrorKind {
  if (status === 401) return 'reauth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  return 'unknown';
}

export function googleErrorMessage(kind: GoogleErrorKind, fr: boolean): string {
  const M: Record<GoogleErrorKind, [string, string]> = {
    reauth: [
      'Your Google connection expired. Please disconnect and connect again.',
      'Votre connexion Google a expiré. Déconnectez-vous puis reconnectez-vous.',
    ],
    forbidden: [
      'Google denied access. Make sure the Business Profile APIs are enabled and approved for your Cloud project, and that you manage this business listing.',
      'Google a refusé l’accès. Vérifiez que les API Business Profile sont activées et approuvées pour votre projet Cloud, et que vous gérez cet établissement.',
    ],
    not_found: [
      'The Google business location was not found. It may have been removed.',
      'L’établissement Google est introuvable. Il a peut-être été supprimé.',
    ],
    rate_limited: [
      'Google is rate-limiting requests. Please wait a few minutes and try again.',
      'Google limite les requêtes. Patientez quelques minutes et réessayez.',
    ],
    config: [
      'Google sign-in is not configured yet. See the setup checklist below.',
      'La connexion Google n’est pas configurée. Consultez la liste de vérification ci-dessous.',
    ],
    unknown: [
      'Google returned an unexpected error. Please try again in a minute.',
      'Google a renvoyé une erreur inattendue. Réessayez dans une minute.',
    ],
  };
  return fr ? M[kind][1] : M[kind][0];
}

/* ------------------------------------------------------------------ */
/* Token refresh + API calls (fetch injected for tests)                 */
/* ------------------------------------------------------------------ */

type FetchImpl = typeof fetch;

export async function refreshAccessToken(
  opts: { clientId: string; clientSecret: string; refreshToken: string },
  fetchImpl: FetchImpl = fetch
): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      refresh_token: opts.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const err = new Error(`Token refresh failed: ${res.status}`) as Error & { kind: GoogleErrorKind };
    err.kind = classifyGoogleError(res.status);
    throw err;
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('Token refresh returned no access token');
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
  };
}

export type GoogleAccount = { accountId: string; name: string };
export type GoogleLocation = { locationId: string; name: string; title: string };

export async function fetchGoogleAccounts(
  accessToken: string,
  fetchImpl: FetchImpl = fetch
): Promise<GoogleAccount[]> {
  const res = await fetchImpl(GOOGLE_ACCOUNT_MGMT_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = new Error(`Accounts fetch failed: ${res.status}`) as Error & { kind: GoogleErrorKind };
    err.kind = classifyGoogleError(res.status);
    throw err;
  }
  const data = (await res.json()) as { accounts?: { name?: string; accountName?: string }[] };
  return (data.accounts ?? [])
    .map((a) => {
      const m = (a.name ?? '').match(/^accounts\/([^/]+)$/);
      if (!m) return null;
      return { accountId: m[1], name: a.accountName ?? a.name ?? m[1] };
    })
    .filter((a): a is GoogleAccount => a !== null);
}

export async function fetchGoogleLocations(
  accessToken: string,
  accountId: string,
  fetchImpl: FetchImpl = fetch
): Promise<GoogleLocation[]> {
  const res = await fetchImpl(
    `${GOOGLE_BUSINESS_INFO_URL}/accounts/${encodeURIComponent(accountId)}/locations?readMask=name,title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const err = new Error(`Locations fetch failed: ${res.status}`) as Error & { kind: GoogleErrorKind };
    err.kind = classifyGoogleError(res.status);
    throw err;
  }
  const data = (await res.json()) as { locations?: { name?: string; title?: string }[] };
  return (data.locations ?? [])
    .map((l) => {
      const m = (l.name ?? '').match(/^accounts\/[^/]+\/locations\/([^/]+)$/);
      if (!m) return null;
      return { locationId: m[1], name: l.name!, title: l.title ?? m[1] };
    })
    .filter((l): l is GoogleLocation => l !== null);
}

/** Fetch ALL review pages for a location (pageSize max 50 per Google docs). */
export async function fetchAllGoogleReviews(
  opts: { accessToken: string; accountId: string; locationId: string },
  fetchImpl: FetchImpl = fetch
): Promise<GoogleApiReview[]> {
  const all: GoogleApiReview[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ pageSize: '50', orderBy: 'updateTime desc' });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await fetchImpl(
      `${GOOGLE_REVIEWS_URL}/accounts/${encodeURIComponent(opts.accountId)}/locations/${encodeURIComponent(opts.locationId)}/reviews?${q}`,
      { headers: { Authorization: `Bearer ${opts.accessToken}` } }
    );
    if (!res.ok) {
      const err = new Error(`Reviews fetch failed: ${res.status}`) as Error & { kind: GoogleErrorKind };
      err.kind = classifyGoogleError(res.status);
      throw err;
    }
    const data = (await res.json()) as { reviews?: GoogleApiReview[]; nextPageToken?: string };
    all.push(...(data.reviews ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return all;
}

export async function revokeGoogleToken(
  token: string,
  fetchImpl: FetchImpl = fetch
): Promise<void> {
  try {
    await fetchImpl(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: 'POST' });
  } catch {
    // Revocation is best-effort; we still delete the local connection.
  }
}
