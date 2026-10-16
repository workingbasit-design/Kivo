/**
 * Per-business feature flags (F1+).
 *
 * Stored as a JSON string on Business.featureFlags, e.g. '{"portalV2": true}'.
 * - Off for all existing businesses (null/{} => all flags off).
 * - New flags default to off unless explicitly enabled.
 *
 * Access: server-side only. Callers must already hold the businessId from
 * the session (requireAuth) — never trust a client-supplied businessId.
 */

export const FLAG_PORTAL_V2 = 'portalV2';

export type FeatureFlags = Record<string, boolean>;

export function parseFlags(raw: string | null | undefined): FeatureFlags {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: FeatureFlags = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'boolean') out[k] = v;
      }
      return out;
    }
  } catch {
    // Corrupt JSON => treat as no flags (fail-closed).
  }
  return {};
}

export function isFlagOn(flags: FeatureFlags, flag: string): boolean {
  return flags[flag] === true;
}

export function serializeFlags(flags: FeatureFlags): string {
  return JSON.stringify(flags);
}

/** Pure helper for toggling one flag; returns the new serialized value. */
export function withFlag(
  raw: string | null | undefined,
  flag: string,
  on: boolean,
): string {
  const flags = parseFlags(raw);
  if (on) {
    flags[flag] = true;
  } else {
    delete flags[flag];
  }
  return serializeFlags(flags);
}
