/**
 * FIX-NOW S2: client-safe dashboard layout helpers.
 *
 * Pure functions + constants only — NO prisma import, so client components
 * (e.g. CustomizePanel) can import these without dragging the Prisma client
 * into the browser bundle (which breaks the production build).
 */

export const DASHBOARD_SECTIONS = [
  "collected",
  "needsYou",
  "keyNumbers",
  "visits",
  "pipeline",
  "last8Weeks",
] as const;

export type DashboardSectionKey = (typeof DASHBOARD_SECTIONS)[number];

export interface SectionPref {
  key: DashboardSectionKey;
  visible: boolean;
}

const MONEY_SECTIONS: ReadonlySet<string> = new Set([
  "collected",
  "keyNumbers",
  "pipeline",
  "last8Weeks",
]);

export function isDashboardSectionKey(v: unknown): v is DashboardSectionKey {
  return typeof v === "string" && (DASHBOARD_SECTIONS as readonly string[]).includes(v);
}

/**
 * Move the section at index i one slot in dir (-1 = up, +1 = down).
 * No-op (returns the input array by reference) when out of bounds.
 */
export function moveSectionPref(prefs: SectionPref[], i: number, dir: -1 | 1): SectionPref[] {
  const j = i + dir;
  if (i < 0 || i >= prefs.length || j < 0 || j >= prefs.length) return prefs;
  const next = [...prefs];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Flip visibility of the section at index i. No-op when out of bounds. */
export function toggleSectionPref(prefs: SectionPref[], i: number): SectionPref[] {
  if (i < 0 || i >= prefs.length) return prefs;
  return prefs.map((s, k) => (k === i ? { ...s, visible: !s.visible } : s));
}

/** Role defaults: dispatcher hides money sections; owner/admin see all. */
export function defaultLayoutForRole(role: string): SectionPref[] {
  const hideMoney = role === "DISPATCHER";
  return DASHBOARD_SECTIONS.map((key) => ({
    key,
    visible: hideMoney ? !MONEY_SECTIONS.has(key) : true,
  }));
}

/**
 * Effective layout: the saved row wins; unknown keys are dropped and any
 * missing known section falls back to the role default (so new sections
 * appear for existing users).
 */
export function mergeLayout(
  saved: { key: string; visible: boolean }[] | null,
  role: string
): SectionPref[] {
  const defaults = defaultLayoutForRole(role);
  if (!saved) return defaults;
  const ordered: SectionPref[] = [];
  // Saved order first…
  for (const s of saved) {
    if (isDashboardSectionKey(s.key) && !ordered.some((o) => o.key === s.key)) {
      ordered.push({ key: s.key, visible: s.visible });
    }
  }
  // …then any sections the saved row doesn't know about.
  for (const d of defaults) {
    if (!ordered.some((o) => o.key === d.key)) ordered.push(d);
  }
  return ordered;
}
