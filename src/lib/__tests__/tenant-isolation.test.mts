/**
 * Tenant-isolation attack suite.
 *
 * Proves the strict Prisma tenant guard (src/lib/tenant-guard.ts) fails
 * CLOSED: any read/write/delete on a business-owned model without an
 * explicit, non-empty `where.businessId` throws TenantScopeError before the
 * query reaches the database. Scoped queries and non-tenant models pass
 * through untouched.
 *
 * These tests exercise the pure decision function and the middleware
 * shape directly — no real Prisma client, no database.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TENANT_MODELS,
  TenantScopeError,
  assertTenantScope,
  tenantGuardMiddleware,
  unsafeUnscoped,
  setUnscopedClient,
} from '../tenant-guard.ts';

const BIZ_A = 'biz_a';
const BIZ_B = 'biz_b';

// Every read/write-by-where action the guard must cover. If Prisma adds a
// new one, it belongs here AND in the guard's GUARDED_ACTIONS.
const ALL_GUARDED_ACTIONS = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
  'create',
  'createMany',
];

function expectBlocked(model: string, action: string, args?: { where?: unknown; data?: unknown }) {
  assert.throws(() => assertTenantScope({ model, action, args }), TenantScopeError, `${model}.${action} must be blocked`);
}

function expectAllowed(model: string, action: string, args?: { where?: unknown; data?: unknown }) {
  assert.doesNotThrow(() => assertTenantScope({ model, action, args }), `${model}.${action} must be allowed`);
}

describe('tenant guard blocks unscoped cross-tenant access', () => {
  it('blocks unscoped reads, writes and deletes on core business models', () => {
    for (const model of ['Job', 'Customer', 'Quote', 'Invoice']) {
      for (const action of ALL_GUARDED_ACTIONS) {
        if (action === 'create' || action === 'createMany') {
          expectBlocked(model, action, { data: { name: 'x' } }); // no businessId
          expectBlocked(model, action, { data: {} }); // empty data
          expectBlocked(model, action, { data: { businessId: '' } }); // empty string
          expectBlocked(model, action, { data: { businessId: null } }); // null
          expectBlocked(model, action); // no args at all
        } else {
          expectBlocked(model, action, { where: { id: 'row_1' } }); // id-only: cross-tenant!
          expectBlocked(model, action); // no args at all
          expectBlocked(model, action, { where: {} }); // empty where
          expectBlocked(model, action, { where: { businessId: '' } }); // empty string
          expectBlocked(model, action, { where: { businessId: null } }); // null
          expectBlocked(model, action, { where: { businessId: undefined } }); // undefined
          expectBlocked(model, action, { where: { businessId: 42 } }); // non-string
        }
      }
    }
  });

  it('blocks when businessId is nested but the top-level where is unscoped', () => {
    // A nested businessId inside OR does NOT scope the query: the other
    // branch can still match another tenant's rows. Fail closed.
    expectBlocked('Job', 'findMany', {
      where: { OR: [{ businessId: BIZ_A }, { status: 'SCHEDULED' }] },
    });
    expectBlocked('Customer', 'findFirst', {
      where: { AND: [{ businessId: BIZ_A }], id: 'row_1' },
    });
  });

  it('throws before the query runs (next is never called)', async () => {
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      return null;
    };
    await assert.rejects(
      () => tenantGuardMiddleware({ model: 'Invoice', action: 'update', args: { where: { id: 'inv_1' } } }, next),
      TenantScopeError
    );
    assert.equal(nextCalled, false, 'guard must throw before delegating to the query');
  });

  it('rejects every action with a TenantScopeError carrying model and action', () => {
    for (const action of ALL_GUARDED_ACTIONS) {
      try {
        const args = (action === 'create' || action === 'createMany')
          ? { data: { title: 'x' } } // creates check data, not where
          : { where: { id: 'q_1' } };
        assertTenantScope({ model: 'Quote', action, args });
        assert.fail(`${action} should have thrown`);
      } catch (err) {
        assert.ok(err instanceof TenantScopeError);
        assert.equal(err.model, 'Quote');
        assert.equal(err.action, action);
      }
    }
  });
});

describe('tenant guard allows legitimate queries', () => {
  it('allows scoped reads/writes/deletes on business models', () => {
    for (const model of ['Job', 'Customer', 'Quote', 'Invoice']) {
      for (const action of ALL_GUARDED_ACTIONS) {
        const args = (action === 'create' || action === 'createMany')
          ? { data: { businessId: BIZ_A, name: 'x' } }
          : { where: { id: 'row_1', businessId: BIZ_A } };
        expectAllowed(model, action, args);
      }
    }
  });

  it('does not leak scope between tenants at the decision level', () => {
    // Tenant A scoped — fine. Same shape with tenant B — fine. Unscoped — blocked.
    expectAllowed('Job', 'update', { where: { id: 'row_1', businessId: BIZ_A } });
    expectAllowed('Job', 'update', { where: { id: 'row_1', businessId: BIZ_B } });
    expectBlocked('Job', 'update', { where: { id: 'row_1' } });
  });

  it('ignores non-tenant models entirely', () => {
    for (const model of ['User', 'InvoiceLineItem', 'Session', 'JobNote']) {
      for (const action of ALL_GUARDED_ACTIONS) {
        expectAllowed(model, action, { where: { id: 'row_1' } });
        expectAllowed(model, action);
      }
    }
  });

  it('ignores unknown models and non-guarded actions', () => {
    expectAllowed('SomeFutureModel', 'findMany', { where: {} });
    expectAllowed(undefined as unknown as string, 'findMany', { where: {} });
    // Creates ARE guarded: missing businessId in data throws.
    expectBlocked('Job', 'create', { data: { name: 'x' } });
    expectBlocked('Job', 'createMany', { data: [{ name: 'x' }] });
    expectAllowed('Job', 'create', { data: { businessId: BIZ_A, name: 'x' } });
    // SupportTicket allows null businessId (public form).
    expectAllowed('SupportTicket', 'create', { data: { businessId: null, name: 'x' } });
    // Payment allows undefined businessId during backfill.
    expectAllowed('Payment', 'create', { data: { amount: 10, invoiceId: 'i1' } });
  });
});

describe('unsafeUnscoped escape hatch', () => {
  it('lazily initializes the unscoped client when lib/prisma.ts was never evaluated', async () => {
    // Regression (2026-10-01): bundlers drop lib/prisma.ts from a route's
    // chunk when nothing in that route's graph *uses* its exports, so the
    // setUnscopedClient() side effect never ran and every agent API route
    // 500'd in production with "unscoped client not initialized".
    // unsafeUnscoped must lazily import lib/prisma.ts instead of throwing.
    let received: unknown = null;
    const result = await unsafeUnscoped('lazy-init', async (db) => {
      received = db;
      return 'ok';
    });
    assert.equal(result, 'ok');
    assert.ok(
      received !== null &&
        typeof (received as { $transaction?: unknown }).$transaction === 'function',
      'callback must receive the lazily-initialized unscoped Prisma client'
    );

    // Inject a mock unguarded client: an explicitly injected client still
    // takes precedence over the lazily-initialized one.
    const mockDb = { marker: 'unguarded-mock' } as unknown as Parameters<
      Parameters<typeof unsafeUnscoped>[1]
    >[0];
    setUnscopedClient(mockDb);

    let received2: unknown = null;
    const result2 = await unsafeUnscoped('test-escape', async (db) => {
      received2 = db;
      return 'ok';
    });
    assert.equal(result2, 'ok');
    assert.equal(received2, mockDb, 'callback must receive the injected client');

    // The guard itself is unchanged: unscoped queries still fail closed
    // when checked directly (the bypass is the separate client, not ALS).
    expectBlocked('ShareToken', 'findFirst', { where: { token: 'secret' } });
  });

  it('records every unscoped operation in the audit trail', async () => {
    const { unscopedEvents } = await import('../tenant-guard.ts');
    const before = unscopedEvents.length;
    const mockDb = {} as never;
    setUnscopedClient(mockDb as never);
    await unsafeUnscoped('audit-test-op', async () => 'x');
    assert.equal(unscopedEvents.length, before + 1);
    assert.equal(unscopedEvents[unscopedEvents.length - 1].op, 'audit-test-op');
  });

  it('does not rely on AsyncLocalStorage (regression: Prisma middleware drops ALS)', async () => {
    // 2026-09-28 production outage: Prisma's `$use` middleware does not
    // preserve Node.js AsyncLocalStorage context (it runs from Prisma's
    // internal engine scheduling, outside the caller's async chain), so an
    // ALS-based exemption never reached the guard and every public token
    // page 500'd with TenantScopeError. The fix is an explicit unguarded
    // client passed to the callback — verify no ALS is involved.
    const src = readFileSync(
      new URL('../tenant-guard.ts', import.meta.url),
      'utf8'
    );
    // unsafeUnscoped must not call .run() on an AsyncLocalStorage.
    const fnBody = src.slice(src.indexOf('export async function unsafeUnscoped'));
    assert.ok(
      !/unscopedStore\.run/.test(fnBody),
      'unsafeUnscoped must not use AsyncLocalStorage.run — use the injected client'
    );
  });
});

function assertTenantScopeSafe(model: string, action: string, args?: { where?: unknown }): string {
  try {
    assertTenantScope({ model, action, args });
    return 'allowed';
  } catch (err) {
    if (err instanceof TenantScopeError) return 'blocked';
    throw err;
  }
}

describe('TENANT_MODELS stays in sync with prisma/schema.prisma', () => {
  it('covers every model with a businessId column (except the identity root User)', () => {
    const schemaPath = new URL('../../../prisma/schema.prisma', import.meta.url);
    const schema = readFileSync(schemaPath, 'utf8');
    const modelsWithBusinessId = new Set<string>();
    for (const block of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
      const [, name, body] = block;
      if (/^\s*businessId\s+\w+/m.test(body)) modelsWithBusinessId.add(name);
    }
    assert.ok(modelsWithBusinessId.size > 40, `expected many tenant models, found ${modelsWithBusinessId.size}`);

    // User is deliberately excluded (identity root — login looks users up
    // globally before any tenant is known; see tenant-guard.ts).
    // AgentProposal IS guarded (fail-closed): every legitimate access goes
    // through explicit unsafeUnscoped with 256-bit token checks, so a
    // future unscoped guarded-client query throws loudly instead of
    // silently succeeding.
    const expected = new Set(modelsWithBusinessId);
    expected.delete('User');
    assert.deepEqual(
      new Set(TENANT_MODELS),
      expected,
      'TENANT_MODELS drifted from schema.prisma: add the new businessId model to the guard (or document why it is excluded)'
    );
  });
});
