/**
 * In-memory stand-in for @/lib/prisma for the durable rate-limiter tests.
 * Map-backed RateLimit table with the same semantics the real limiter
 * relies on: updateMany only touches unexpired rows, upsert resets the
 * bucket, findUnique returns the row. Exposes the store so tests can
 * prove the count lives in the "DB", not in the limiter module.
 */
export const rateLimitStore = new Map();

let shouldThrow = false;
export function setRateLimitShouldThrow(v) {
  shouldThrow = v;
}

export const prisma = {
  rateLimit: {
    updateMany: async ({ where, data }) => {
      if (shouldThrow) throw new Error('stub DB down');
      const row = rateLimitStore.get(where?.key);
      if (row && row.resetAt > where?.resetAt?.gt) {
        row.count += data?.count?.increment ?? 1;
        return { count: 1 };
      }
      return { count: 0 };
    },
    upsert: async ({ where, create, update }) => {
      if (shouldThrow) throw new Error('stub DB down');
      const row = { key: where.key, count: 1, resetAt: (create ?? update).resetAt };
      rateLimitStore.set(where.key, row);
      return row;
    },
    findUnique: async ({ where }) => {
      if (shouldThrow) throw new Error('stub DB down');
      const row = rateLimitStore.get(where?.key);
      return row ? { count: row.count, resetAt: row.resetAt } : null;
    },
  },
};
