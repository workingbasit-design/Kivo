/**
 * Unit tests for Google review sync pure logic (src/lib/google-reviews.ts —
 * Track 5). All HTTP is mocked; no live Google calls.
 * Run: node --test src/lib/__tests__/google-reviews.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  starRatingToInt,
  mapGoogleReview,
  dedupeNewReviews,
  buildAuthUrl,
  classifyGoogleError,
  googleErrorMessage,
  refreshAccessToken,
  fetchGoogleAccounts,
  fetchGoogleLocations,
  fetchAllGoogleReviews,
  googleScopes,
  type GoogleApiReview,
} from '@/lib/google-reviews.ts';

function mockFetch(
  handler: (url: string, init?: RequestInit) => { ok: boolean; status: number; body: unknown }
) {
  return (async (url: unknown, init?: RequestInit) => {
    const r = handler(String(url), init);
    return {
      ok: r.ok,
      status: r.status,
      json: async () => r.body,
    };
  }) as unknown as typeof fetch;
}

test('starRatingToInt maps Google enum to 1-5, never guesses', () => {
  assert.equal(starRatingToInt('FIVE'), 5);
  assert.equal(starRatingToInt('ONE'), 1);
  assert.equal(starRatingToInt('THREE'), 3);
  assert.equal(starRatingToInt(null), null);
  assert.equal(starRatingToInt(undefined), null);
  assert.equal(starRatingToInt('SIX'), null);
  assert.equal(starRatingToInt('STAR_RATING_UNSPECIFIED'), null);
});

test('mapGoogleReview maps a full review', () => {
  const g: GoogleApiReview = {
    name: 'accounts/123/locations/456/reviews/abc',
    reviewId: 'abc',
    reviewer: { displayName: 'Jane D.', isAnonymous: false },
    starRating: 'FIVE',
    comment: 'Great work!',
    createTime: '2026-08-01T12:00:00Z',
  };
  const m = mapGoogleReview(g);
  assert.ok(m);
  assert.equal(m.externalId, 'accounts/123/locations/456/reviews/abc');
  assert.equal(m.rating, 5);
  assert.equal(m.comment, 'Great work!');
  assert.equal(m.reviewerName, 'Jane D.');
  assert.equal(m.reviewedAt?.toISOString(), '2026-08-01T12:00:00.000Z');
});

test('mapGoogleReview hides anonymous reviewers, tolerates missing fields', () => {
  const anon = mapGoogleReview({
    name: 'accounts/1/locations/2/reviews/x',
    reviewer: { displayName: 'Hidden', isAnonymous: true },
    starRating: 'FOUR',
  });
  assert.ok(anon);
  assert.equal(anon.reviewerName, null);
  assert.equal(anon.comment, null);
  assert.equal(anon.reviewedAt, null);
});

test('mapGoogleReview returns null when id or rating is unusable', () => {
  assert.equal(mapGoogleReview({ starRating: 'FIVE' } as GoogleApiReview), null);
  assert.equal(
    mapGoogleReview({ name: 'accounts/1/locations/2/reviews/x' } as GoogleApiReview),
    null
  );
  assert.equal(
    mapGoogleReview({ name: 'accounts/1/locations/2/reviews/x', starRating: 'BOGUS' }),
    null
  );
});

test('dedupeNewReviews never re-imports existing externalIds', () => {
  const existing = new Set(['accounts/1/locations/2/reviews/a']);
  const fetched = [
    { externalId: 'accounts/1/locations/2/reviews/a', rating: 5, comment: null, reviewerName: null, reviewedAt: null },
    { externalId: 'accounts/1/locations/2/reviews/b', rating: 4, comment: 'ok', reviewerName: 'Sam', reviewedAt: null },
  ];
  const fresh = dedupeNewReviews(existing, fetched);
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].externalId, 'accounts/1/locations/2/reviews/b');
});

test('buildAuthUrl includes offline access + business.manage scope + state', () => {
  const url = buildAuthUrl({
    clientId: 'cid',
    redirectUri: 'https://app.example/api/google/callback',
    state: 'biz123',
    scopes: googleScopes(),
  });
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(u.searchParams.get('client_id'), 'cid');
  assert.equal(u.searchParams.get('access_type'), 'offline');
  assert.equal(u.searchParams.get('prompt'), 'consent');
  assert.equal(u.searchParams.get('state'), 'biz123');
  assert.ok(u.searchParams.get('scope')?.includes('business.manage'));
  assert.equal(
    u.searchParams.get('redirect_uri'),
    'https://app.example/api/google/callback'
  );
});

test('classifyGoogleError + bilingual messages', () => {
  assert.equal(classifyGoogleError(401), 'reauth');
  assert.equal(classifyGoogleError(403), 'forbidden');
  assert.equal(classifyGoogleError(404), 'not_found');
  assert.equal(classifyGoogleError(429), 'rate_limited');
  assert.equal(classifyGoogleError(500), 'unknown');
  assert.match(googleErrorMessage('reauth', false), /expired/i);
  assert.match(googleErrorMessage('reauth', true), /expiré/i);
});

test('refreshAccessToken posts the right grant and parses expiry', async () => {
  let seenBody = '';
  const f = mockFetch((url, init) => {
    seenBody = String((init?.body as URLSearchParams)?.toString() ?? init?.body);
    return { ok: true, status: 200, body: { access_token: 'newtok', expires_in: 3600 } };
  });
  const before = Date.now();
  const r = await refreshAccessToken(
    { clientId: 'c', clientSecret: 's', refreshToken: 'r' },
    f
  );
  assert.equal(r.accessToken, 'newtok');
  assert.ok(r.expiresAt.getTime() > before + 3500_000);
  assert.ok(seenBody.includes('grant_type=refresh_token'));
  assert.ok(seenBody.includes('refresh_token=r'));
});

test('refreshAccessToken classifies a 401 as reauth', async () => {
  const f = mockFetch(() => ({ ok: false, status: 401, body: {} }));
  await assert.rejects(
    refreshAccessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'bad' }, f),
    (e: Error & { kind?: string }) => e.kind === 'reauth'
  );
});

test('fetchGoogleAccounts parses account ids', async () => {
  const f = mockFetch(() => ({
    ok: true,
    status: 200,
    body: { accounts: [{ name: 'accounts/111', accountName: 'My Biz' }, { name: 'bogus' }] },
  }));
  const accounts = await fetchGoogleAccounts('tok', f);
  assert.deepEqual(accounts, [{ accountId: '111', name: 'My Biz' }]);
});

test('fetchGoogleLocations parses location ids', async () => {
  const f = mockFetch((url) => {
    assert.ok(String(url).includes('/accounts/111/locations'));
    return {
      ok: true,
      status: 200,
      body: { locations: [{ name: 'accounts/111/locations/222', title: 'Downtown' }] },
    };
  });
  const locs = await fetchGoogleLocations('tok', '111', f);
  assert.deepEqual(locs, [{ locationId: '222', name: 'accounts/111/locations/222', title: 'Downtown' }]);
});

test('fetchAllGoogleReviews follows pagination', async () => {
  const r1: GoogleApiReview = { name: 'accounts/1/locations/2/reviews/a', starRating: 'FIVE' };
  const r2: GoogleApiReview = { name: 'accounts/1/locations/2/reviews/b', starRating: 'ONE' };
  let calls = 0;
  const f = mockFetch(() => {
    calls++;
    return calls === 1
      ? { ok: true, status: 200, body: { reviews: [r1], nextPageToken: 'tok2' } }
      : { ok: true, status: 200, body: { reviews: [r2] } };
  });
  const all = await fetchAllGoogleReviews({ accessToken: 't', accountId: '1', locationId: '2' }, f);
  assert.equal(calls, 2);
  assert.equal(all.length, 2);
});

test('fetchAllGoogleReviews classifies a 403 as forbidden', async () => {
  const f = mockFetch(() => ({ ok: false, status: 403, body: { error: 'denied' } }));
  await assert.rejects(
    fetchAllGoogleReviews({ accessToken: 't', accountId: '1', locationId: '2' }, f),
    (e: Error & { kind?: string }) => e.kind === 'forbidden'
  );
});
