/**
 * Prisma stub for copilot engine tests: reads return fixture data (default:
 * an empty business), and every write is recorded so tests can assert the
 * copilot NEVER writes.
 */
export const writeCalls = [];

/** Reads are recorded (never executed) so tests can assert query clauses. */
export const readCalls = [];

export function resetReadCalls() {
  readCalls.length = 0;
}

/** Per-model fixture overrides, e.g. setFixture('invoice', 'findMany', [...]) */
const fixtures = new Map();

// In-memory RateLimit table for the durable limiter (P1.0 S4 P3): mirrors
// the auth-stub delegate; updateMany only touches unexpired rows.
const rateLimitRows = new Map();
const rateLimitDelegate = {
  updateMany: async ({ where, data }) => {
    const row = rateLimitRows.get(where?.key);
    if (row && row.resetAt > where?.resetAt?.gt) {
      row.count += data?.count?.increment ?? 1;
      return { count: 1 };
    }
    return { count: 0 };
  },
  upsert: async ({ where, create, update }) => {
    const row = { key: where.key, count: 1, resetAt: (create ?? update).resetAt };
    rateLimitRows.set(where.key, row);
    return row;
  },
  findUnique: async ({ where }) => {
    const row = rateLimitRows.get(where?.key);
    return row ? { count: row.count, resetAt: row.resetAt } : null;
  },
};

export function setFixture(model, method, value) {
  fixtures.set(`${model}.${method}`, value);
}

export function clearFixtures() {
  fixtures.clear();
  rateLimitRows.clear();
}

function recordWrite(model, method, args) {
  writeCalls.push({ model, method, args });
}

function delegate(model) {
  return new Proxy(
    {},
    {
      get(_t, method) {
        const key = `${model}.${String(method)}`;
        if (fixtures.has(key)) {
          const v = fixtures.get(key);
          return async (args) => {
            if (method === 'findMany' || method === 'findFirst' || method === 'findUnique') {
              readCalls.push({ model, method: String(method), args });
            }
            return v;
          };
        }
        if (method === 'findFirst' || method === 'findUnique') {
          return async (args) => {
            readCalls.push({ model, method: String(method), args });
            return null;
          };
        }
        if (method === 'findMany') {
          return async (args) => {
            readCalls.push({ model, method: String(method), args });
            return [];
          };
        }
        if (method === 'count') {
          return async () => 0;
        }
        if (method === 'aggregate') {
          return async () => ({ _sum: { amount: null } });
        }
        // create / update / upsert / delete / createMany / ... - record, never execute
        return async (args) => {
          recordWrite(model, String(method), args);
          return null;
        };
      },
    }
  );
}

export const prisma = new Proxy(
  {},
  {
    get(_t, model) {
      if (model === '$transaction') {
        // Run the transactional callback against the stub itself. Writes
        // inside are recorded like any other write.
        return async (fn) => fn(prisma);
      }
      if (model === '$queryRaw') {
        // nextDocumentNumber's counter read (quote confirm path, 2026-11-14).
        return async () => [{ nextNumber: 7, prefix: 'Q-', padding: 4 }];
      }
      if (model === '$executeRaw') {
        // nextDocumentNumber's counter insert/bump (quote confirm path).
        return async () => 1;
      }
      if (model === 'rateLimit') {
        // Durable limiter state (P1.0 S4 P3) — NOT a recorded write: the
        // limiter is infrastructure, not copilot business writes.
        return rateLimitDelegate;
      }
      return delegate(String(model));
    },
  }
);

export function resetWriteCalls() {
  writeCalls.length = 0;
}
