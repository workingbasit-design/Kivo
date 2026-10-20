/**
 * Part C (dashboard rebuild): "Customize this screen".
 *
 * Section order and visibility are saved per user on the server
 * (DashboardLayout, migration m28). A missing row means role defaults:
 * owner/admin see everything, dispatchers see no money sections, and
 * technicians get the "My day" view instead of the full dashboard.
 *
 * Pure helpers live in ./dashboard-layout-client.ts (no prisma import) so
 * client components can import them without breaking the browser build.
 */
import { prisma } from "@/lib/prisma";

export * from "./dashboard-layout-client.ts";
export type { DashboardSectionKey, SectionPref } from "./dashboard-layout-client.ts";
import { defaultLayoutForRole, mergeLayout } from "./dashboard-layout-client.ts";

export async function getDashboardLayout(
  userId: string,
  businessId: string,
  role: string
): Promise<import("./dashboard-layout-client.ts").SectionPref[]> {
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
