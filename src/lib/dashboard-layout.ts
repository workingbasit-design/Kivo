/**
 * Part C (dashboard rebuild): "Customize this screen".
 *
 * Section order and visibility are saved per user on the server
 * (DashboardLayout, migration m28). A missing row means role defaults:
 * owner/admin see everything, dispatchers see no money sections, and
 * technicians get the "My day" view instead of the full dashboard.
 */
import { prisma } from "@/lib/prisma";

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

export async function getDashboardLayout(
  userId: string,
  businessId: string,
  role: string
): Promise<SectionPref[]> {
  const row = await prisma.dashboardLayout.findUnique({
    where: { userId_businessId: { userId, businessId } },
    select: { sections: true },
  });
  if (!row) return defaultLayoutForRole(role);
  try {
    const parsed = JSON.parse(row.sections) as { key: string; visible: boolean }[];
    if (!Array.isArray(parsed)) return defaultLayoutForRole(role);
    return mergeLayout(parsed, role);
  } catch {
    return defaultLayoutForRole(role);
  }
}
