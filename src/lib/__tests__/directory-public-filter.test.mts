/**
 * B1.4: an unapproved directory listing must never appear in public
 * results. Pins the filter semantics: public queries require BOTH
 * directoryOptIn=true AND directoryVerifiedAt != null.
 *
 * The public queries (src/app/directory/page.tsx, /api/agent/v1/*) use:
 *   where: { directoryOptIn: true, directoryVerifiedAt: { not: null }, ... }
 * This test simulates that filter against listing states.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);

const { isListingPublic } = await import('../directory-claim.ts');

interface Listing {
  id: string;
  directoryOptIn: boolean;
  directoryVerifiedAt: Date | null;
}

/** Simulates the Prisma where filter used by public directory queries. */
function publicFilter(l: Listing): boolean {
  return l.directoryOptIn === true && l.directoryVerifiedAt !== null;
}

const listings: Listing[] = [
  { id: 'approved', directoryOptIn: true, directoryVerifiedAt: new Date('2026-10-01') },
  { id: 'claimed-not-approved', directoryOptIn: true, directoryVerifiedAt: null },
  { id: 'never-claimed', directoryOptIn: false, directoryVerifiedAt: null },
  { id: 'opted-out', directoryOptIn: false, directoryVerifiedAt: new Date('2026-09-01') },
];

describe('B1.4 public directory filter', () => {
  it('only approved listings pass the public filter', () => {
    const public_ = listings.filter(publicFilter).map((l) => l.id);
    assert.deepEqual(public_, ['approved']);
  });
  it('a claimed-but-unapproved listing is never public', () => {
    const listing = listings.find((l) => l.id === 'claimed-not-approved')!;
    assert.equal(publicFilter(listing), false);
    assert.equal(isListingPublic(listing.directoryOptIn, listing.directoryVerifiedAt), false);
  });
  it('filter semantics match isListingPublic for every state', () => {
    for (const l of listings) {
      assert.equal(
        publicFilter(l),
        isListingPublic(l.directoryOptIn, l.directoryVerifiedAt),
        `mismatch for ${l.id}`
      );
    }
  });
});
