/**
 * Scroll lesson 8 — "add to public directory profile" prompt.
 *
 * After a job is DONE for a customer who consented, the pro gets one
 * tap to add that job's service to their public directory profile, so
 * new customers can find them for the same work. The prompt carries
 * NO customer data — only the job's service name (the title) — so
 * nothing about the customer ever reaches the public profile.
 *
 * Gates (all must hold before the prompt is offered):
 * - the job is COMPLETED or PAID (done work only, never in-progress);
 * - the customer gave CASL messaging consent (messageConsent);
 * - the business has a directory profile page (booking page);
 * - the service is not already listed on that profile.
 * The page checks the last three server-side and passes the service
 * through; the client gates on the LIVE status so the prompt appears
 * right after an in-session Mark complete, not only after a reload.
 * The add action re-checks every gate, so a crafted call cannot add
 * a service for an in-progress job or a non-consented customer.
 */
import { parseServiceAreas } from "./directory-claim.ts";

export const DIRECTORY_AREA_LIMIT = 12;

/** Case-insensitive membership: "furnace tune-up" === "Furnace Tune-Up". */
export function isServiceListed(areas: string[], service: string): boolean {
  const want = service.trim().toLowerCase();
  if (!want) return false;
  return areas.some((a) => a.trim().toLowerCase() === want);
}

export type AppendServiceResult =
  | { ok: true; areas: string[] }
  | { ok: false; reason: "listed" | "blank" | "full" };

/**
 * Append a service to the profile's areas. Refusals are explicit, so
 * the caller can tell the pro the truth: already listed, blank, or
 * the profile's 12-area cap is full (the form enforces the same cap).
 */
export function appendServiceArea(
  areas: string[],
  service: string,
): AppendServiceResult {
  const clean = service.trim();
  if (!clean) return { ok: false, reason: "blank" };
  if (isServiceListed(areas, clean)) return { ok: false, reason: "listed" };
  if (areas.length >= DIRECTORY_AREA_LIMIT) return { ok: false, reason: "full" };
  return { ok: true, areas: [...areas, clean] };
}

/** Parse a stored serviceAreas JSON column, tolerating bad data. */
export function readServiceAreas(json: string | null | undefined): string[] {
  try {
    return parseServiceAreas(json);
  } catch {
    return [];
  }
}
