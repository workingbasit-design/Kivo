/**
 * Pure directory claim-verification logic (Track 4A).
 *
 * No Next.js imports here so this module runs under plain node:test.
 * The server actions in src/app/actions/directory-profile.ts implement the
 * same rules against the database.
 */

/* ------------------------------------------------------------------ */
/* Directory claim verification (Track 4A)                             */
/* ------------------------------------------------------------------ */

export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Is this listing publicly visible? Requires BOTH opt-in and an approved
 * (verified) claim. Unverified/unclaimed listings never go public.
 */
export function isListingPublic(
  directoryOptIn: boolean,
  directoryVerifiedAt: Date | string | null | undefined
): boolean {
  return directoryOptIn === true && directoryVerifiedAt != null;
}

/**
 * Parse the BookingPage.serviceAreas JSON column into a clean string list.
 * Never throws — malformed data yields an empty list, not a crash.
 */
export function parseServiceAreas(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a): a is string => typeof a === 'string')
      .map((a) => a.trim())
      .filter(Boolean)
      .slice(0, 12);
  } catch {
    return [];
  }
}

/**
 * Normalize free-text area input ("Toronto, Scarborough") into the JSON
 * stored on BookingPage.serviceAreas. Returns null when empty.
 */
export function serviceAreasToJson(input: string | null | undefined): string | null {
  const areas = (input ?? '')
    .split(/[,\n]/)
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 12);
  return areas.length > 0 ? JSON.stringify(areas) : null;
}

/**
 * Claim state machine: what a new request/decision does to visibility.
 * Pure — the server actions implement the same rules against the DB.
 */
export function claimTransition(
  current: { status: ClaimStatus | null; verifiedAt: Date | null },
  event: 'request' | 'approve' | 'reject' | 'opt_out'
): { status: ClaimStatus; public: boolean } {
  switch (event) {
    case 'request':
      // New (or re-) request always goes to PENDING and unpublishes.
      return { status: 'PENDING', public: false };
    case 'approve':
      return { status: 'APPROVED', public: true };
    case 'reject':
      return { status: 'REJECTED', public: false };
    case 'opt_out':
      // Opting out unpublishes but keeps the claim record for history.
      return { status: current.status ?? 'PENDING', public: false };
  }
}
