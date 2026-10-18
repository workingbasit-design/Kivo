/**
 * FIX-NOW S2: in-memory stand-ins for the modules on the dashboard-layout
 * save/read path. The REAL src/lib/dashboard-layout.ts (mergeLayout,
 * moveSectionPref, toggleSectionPref, getDashboardLayout) and the REAL
 * src/app/actions/dashboard-layout.ts (saveDashboardLayout) are what's
 * under test; everything else on the path is stubbed.
 *
 * - @/lib/prisma → fake `dashboardLayout` delegate (upsert/findUnique)
 *   backed by a Map, so persistence across "reload" is real within the test.
 * - @/lib/auth → requireAuth returns the settable test member.
 * - next/cache → revalidatePath spy (records the paths).
 */
const rows = new Map(); // `${userId}|${businessId}` -> sections JSON string

export const revalidatedPaths = [];

let testUser = { id: 'user_1' };
let testBusinessId = 'biz_1';

export function setTestMember(user, businessId) {
  testUser = user;
  testBusinessId = businessId;
}

export function resetReorderStub() {
  rows.clear();
  revalidatedPaths.length = 0;
  testUser = { id: 'user_1' };
  testBusinessId = 'biz_1';
}

// @/lib/prisma
export const prisma = {
  dashboardLayout: {
    findUnique: async ({ where }) => {
      const k = where?.userId_businessId;
      const sections = rows.get(`${k?.userId}|${k?.businessId}`);
      return sections === undefined ? null : { sections };
    },
    upsert: async ({ where, update, create }) => {
      const k = where?.userId_businessId;
      const sections = (update ?? create).sections;
      rows.set(`${k?.userId}|${k?.businessId}`, sections);
      return { userId: k?.userId, businessId: k?.businessId, sections };
    },
  },
};

// @/lib/auth
export async function requireAuth() {
  return { user: testUser, businessId: testBusinessId, role: 'OWNER' };
}

// next/cache
export function revalidatePath(path) {
  revalidatedPaths.push(path);
}
