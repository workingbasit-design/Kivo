/**
 * Test-only prisma stub for F10 (f10-notify) tests. In-memory Notification
 * store; records every call so tests can assert tenant scoping and the
 * feature-flag / preference gates.
 */
export const businesses = new Map(); // businessId -> { notificationSettings, featureFlags }
export const notifications = []; // created Notification rows
export const calls = [];

export const prisma = {
  business: {
    findUnique: async ({ where, select }) => {
      calls.push({ model: 'business', op: 'findUnique', where });
      const b = businesses.get(where.id);
      if (!b) return null;
      const out = {};
      if (select?.notificationSettings !== false) out.notificationSettings = b.notificationSettings ?? null;
      if (select?.featureFlags !== false) out.featureFlags = b.featureFlags ?? null;
      return out;
    },
  },
  notification: {
    create: async ({ data }) => {
      calls.push({ model: 'notification', op: 'create', data });
      if (notifications.some((n) => n.businessId === data.businessId && n.dedupeKey === data.dedupeKey)) {
        const err = new Error('Unique constraint failed');
        err.code = 'P2002';
        throw err;
      }
      const row = { id: `n${notifications.length + 1}`, ...data, readAt: null, createdAt: new Date() };
      notifications.push(row);
      return row;
    },
    findMany: async ({ where, take }) => {
      calls.push({ model: 'notification', op: 'findMany', where });
      let rows = notifications.filter((n) => n.businessId === where.businessId);
      const or = where.OR;
      if (or) {
        rows = rows.filter((n) => or.some((c) => c.userId === null ? n.userId == null : n.userId === c.userId));
      }
      return rows.slice(0, take ?? 100);
    },
    count: async ({ where }) => {
      calls.push({ model: 'notification', op: 'count', where });
      let rows = notifications.filter((n) => n.businessId === where.businessId);
      if (where.readAt === null) rows = rows.filter((n) => n.readAt == null);
      const or = where.OR;
      if (or) {
        rows = rows.filter((n) => or.some((c) => c.userId === null ? n.userId == null : n.userId === c.userId));
      }
      return rows.length;
    },
  },
};

export function resetF10Stub() {
  businesses.clear();
  notifications.length = 0;
  calls.length = 0;
}
