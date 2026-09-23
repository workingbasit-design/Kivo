/**
 * Prisma stub for copilot engine tests: reads return fixture data (default:
 * an empty business), and every write is recorded so tests can assert the
 * copilot NEVER writes.
 */
export const writeCalls = [];

/** Per-model fixture overrides, e.g. setFixture('invoice', 'findMany', [...]) */
const fixtures = new Map();

export function setFixture(model, method, value) {
  fixtures.set(`${model}.${method}`, value);
}

export function clearFixtures() {
  fixtures.clear();
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
          return async () => v;
        }
        if (method === 'findFirst' || method === 'findUnique') {
          return async () => null;
        }
        if (method === 'findMany') {
          return async () => [];
        }
        if (method === 'count') {
          return async () => 0;
        }
        if (method === 'aggregate') {
          return async () => ({ _sum: { amount: null } });
        }
        // create / update / upsert / delete / createMany / ... — record, never execute
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
      return delegate(String(model));
    },
  }
);

export function resetWriteCalls() {
  writeCalls.length = 0;
}
