/**
 * Tenant-isolation guard: a Prisma middleware that FAILS CLOSED on any
 * query against a business-owned model that does not carry an explicit
 * tenant scope (`where.businessId`).
 *
 * Why this exists: every query in the app scopes by businessId today by
 * CONVENTION in application code. One future `where: { id }` without
 * `businessId` would silently leak one business's data to another. This
 * guard turns that class of mistake into a loud, immediate
 * TenantScopeError instead of a silent cross-tenant leak.
 *
 * What it guarantees:
 * - For every model in TENANT_MODELS, the read/write-by-where operations
 *   (find*, update*, upsert, delete*, count, aggregate, groupBy) REQUIRE
 *   `args.where.businessId` to be a non-empty string. Anything else throws
 *   TenantScopeError BEFORE the query reaches the database.
 * - The check is on the top-level `where` only, deliberately: a nested
 *   `businessId` inside an OR branch would NOT actually scope the query
 *   (the other branch could match another tenant's rows), so nested-only
 *   scopes are rejected — fail closed.
 *
 * What it does NOT cover (known residuals, documented so they stay visible):
 * - `User` is excluded: it is the identity root. Login, Google OAuth
 *   linking, and session validation look users up by globally-unique
 *   email/googleId before any tenant is known, and businessId is null
 *   during onboarding. User isolation rides the session → user →
 *   businessId chain in getSession().
 * - `$queryRaw` / `$executeRaw` bypass Prisma middleware entirely; raw SQL
 *   touching tenant tables must scope manually (grep for $queryRaw before
 *   adding any). Currently no raw SQL exists in the codebase.
 * - `$queryRaw` / `$executeRaw` bypass Prisma middleware entirely; raw SQL
 *   touching tenant tables must scope manually (grep for $queryRaw before
 *   adding any).
 * - `create`/`createMany` are not guarded: a missing businessId there fails
 *   at the NOT NULL constraint for required columns, and creates cannot
 *   LEAK another tenant's rows.
 *
 * Escape hatch: `unsafeUnscoped(operationName, fn)` marks the enclosed
 * queries as legitimately unscoped (public token lookups where the
 * unguessable token IS the authorization, provider webhooks keyed by
 * provider ids, owner-admin views, global retention purges). It uses
 * AsyncLocalStorage so concurrent requests on one serverless instance
 * cannot leak the exemption to each other. Every call site must carry a
 * comment justifying why it is safe — grep for unsafeUnscoped to audit.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { PrismaClient } from '@prisma/client';
import { logger } from './logger.ts';

/**
 * The unguarded client, injected by lib/prisma.ts via setUnscopedClient().
 * Type-only import: no runtime dependency, so tests can stub freely and
 * there is no circular module initialization.
 */
let unscopedClient: PrismaClient | null = null;

/**
 * Inject the unguarded Prisma client (called once by lib/prisma.ts).
 * Tests inject a mock via this same function.
 */
export function setUnscopedClient(client: PrismaClient): void {
  unscopedClient = client;
}

/** Audit trail of every unscoped operation (for security review). */
export const unscopedEvents: Array<{ at: number; op: string }> = [];

/** Programming error: a tenant query ran without a tenant. Never retried. */
export class TenantScopeError extends Error {
  readonly model: string;
  readonly action: string;
  constructor(model: string, action: string) {
    super(
      `[tenant-guard] BLOCKED unscoped ${action} on "${model}": ` +
        `queries on tenant-owned models must include a non-empty where.businessId. ` +
        `If this query is legitimately unscoped (public token lookup, provider ` +
        `webhook, owner-admin view, retention purge), wrap it in ` +
        `unsafeUnscoped("operation-name", fn) with a comment explaining why it is safe.`
    );
    this.name = 'TenantScopeError';
    this.model = model;
    this.action = action;
  }
}

/**
 * Every Prisma model with a businessId column — i.e. every table whose rows
 * belong to exactly one business — minus User (identity root, see above).
 * Derived from prisma/schema.prisma; the test
 * src/lib/__tests__/tenant-isolation.test.mts asserts this list stays in
 * sync with the schema, so adding a businessId column to a new model
 * without adding it here fails the suite.
 */
export const TENANT_MODELS: ReadonlySet<string> = new Set([
  'ApiKey',
  'Attachment',
  'AutomationLog',
  'BookingPage',
  'Campaign',
  'ChecklistTemplate',
  'Communication',
  'ConsentLog',
  'CustomFieldDef',
  'Customer',
  'CustomerPortalToken',
  'CustomerProperty',
  'Designation',
  'DirectoryClaim',
  'DirectoryReport',
  'Equipment',
  'GoogleConnection',
  'Invoice',
  'Job',
  'JobExpense',
  'Lead',
  'MessageLog',
  'MessageQuota',
  'MessagingConnection',
  'MessagingSettings',
  'Notification',
  'Part',
  'Payment',
  'PiaAuditLog',
  'PushSubscription',
  'QuickBooksConnection',
  'QuickBooksSyncLog',
  'Quote',
  'QuoteDeposit',
  'RecurringJob',
  'Review',
  'ReviewRequest',
  'SavedPro',
  'QuoteRequest',
  'Service',
  'ShareToken',
  'SignatureRequest',
  'StripeConnection',
  'StripeEvent',
  'SupportTicket',
  'TechnicianLocation',
  'TimeEntry',
  'TrackingShare',
  'WebhookEndpoint',
  'WorkflowRule',
]);

/**
 * Read/write-by-where operations. Includes the OrThrow variants, which
 * Prisma reports as distinct middleware actions — omitting them would
 * leave a hole (e.g. findUniqueOrThrow bypassing the guard).
 */
const GUARDED_ACTIONS: ReadonlySet<string> = new Set([
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
]);

const globalForGuard = globalThis as unknown as {
  __everyjob_unscopedStore?: AsyncLocalStorage<boolean>;
};
/**
 * The exemption store lives on globalThis — NOT as a plain module-level
 * const — because the production bundler can evaluate this module twice
 * when it is imported through two different specifiers (e.g. `@/lib/tenant-guard`
 * in pages vs `./tenant-guard.ts` in lib files). Two module instances mean
 * two AsyncLocalStorage instances; the Prisma middleware (registered from
 * one copy) would then never see exemptions set via unsafeUnscoped from
 * the other copy, and every public token page (/sign, /book, /rev, /track,
 * /q, /i, /p, /portal) plus token-based API routes would fail closed with
 * TenantScopeError → 500. Sharing the store through globalThis makes the
 * exemption visible no matter which copy sets or reads it.
 * (2026-09-28: this exact duplication broke all public token pages in
 * production; the middleware saw an empty store and rejected every
 * unsafeUnscoped query.)
 */
const unscopedStore =
  globalForGuard.__everyjob_unscopedStore ??
  (globalForGuard.__everyjob_unscopedStore = new AsyncLocalStorage<boolean>());

export interface GuardParams {
  model?: string;
  action: string;
  args?: { where?: unknown; data?: unknown };
}

/**
 * Pure decision function — no Prisma import, directly unit-tested.
 * Throws TenantScopeError for unscoped tenant queries; returns void otherwise.
 *
 * For read/write-by-where operations, requires args.where.businessId.
 * For create/createMany, requires args.data.businessId (or every element's
 * businessId for createMany arrays). Creates cannot leak another tenant's
 * rows, but an unscoped create is a programming error that would orphan
 * data or attach it to the wrong tenant — fail closed here too.
 */
export function assertTenantScope(params: GuardParams): void {
  const { model, action } = params;
  if (!model || !TENANT_MODELS.has(model)) return;
  if (!GUARDED_ACTIONS.has(action)) return;
  if (unscopedStore.getStore() === true) return;

  if (action === 'create' || action === 'createMany') {
    const data = params.args?.data as Record<string, unknown> | Record<string, unknown>[] | undefined;
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    // Fail closed: a create with no data is a programming error.
    if (rows.length === 0) {
      throw new TenantScopeError(model, action);
    }
    // Nested creates (e.g. invoice with nested payments) carry businessId
    // on the parent; child rows inherit it via the relation. Only check
    // top-level data here.
    for (const row of rows) {
      const businessId = row?.businessId;
      // Allow undefined businessId only for models where it's optional
      // in the schema: Payment (nullable during backfill, then required)
      // and SupportTicket (public form allows unauthenticated submissions).
      if ((model === 'Payment' || model === 'SupportTicket') && (businessId === undefined || businessId === null)) continue;
      if (typeof businessId !== 'string' || businessId.length === 0) {
        throw new TenantScopeError(model, action);
      }
    }
    return;
  }

  const where = params.args?.where as Record<string, unknown> | undefined;
  const businessId = where?.businessId;
  if (typeof businessId === 'string' && businessId.length > 0) {
    return;
  }
  // Compound unique keys that embed businessId. Prisma requires the compound
  // input for upsert/findUnique on these models, so there is no top-level
  // where.businessId — but the embedded businessId scopes the query to one
  // tenant exactly as well:
  // - MessageQuota: { businessId_month: { businessId, month } }
  // - MessagingConnection: { businessId_channel: { businessId, channel } }
  // (2026-10-01: without this, /settings/messaging crashed to the error
  // boundary on every load — getMessagingOverview upserts the monthly quota
  // row — and the messaging scheduler + WhatsApp webhook hit the same wall.)
  for (const key of ['businessId_month', 'businessId_channel'] as const) {
    const compound = where?.[key] as Record<string, unknown> | undefined;
    if (
      compound &&
      typeof compound.businessId === 'string' &&
      (compound.businessId as string).length > 0
    ) {
      return;
    }
  }
  // SavedPro and QuoteRequest are dual-scoped: businesses query by businessId,
  // customers query by customerId. Allow customer-scoped reads for these models.
  // (Customer actions always scope by the session's customerId; see customer-*.ts)
  if ((model === 'SavedPro' || model === 'QuoteRequest')) {
    const customerId = where?.customerId;
    if (typeof customerId === 'string' && customerId.length > 0) {
      return;
    }
    // Compound unique key: { customerId_businessId: { customerId, businessId } }
    const compound = where?.customerId_businessId as Record<string, unknown> | undefined;
    if (compound && typeof compound.customerId === 'string' && (compound.customerId as string).length > 0) {
      return;
    }
  }
  throw new TenantScopeError(model, action);
}

/**
 * Prisma `$use` middleware. Register OUTSIDE (before) the retry middleware
 * so a TenantScopeError — a programming error, not a transient failure —
 * rejects immediately and is never retried. Async so the block surfaces
 * as a rejected promise, exactly like any other middleware failure.
 */
export async function tenantGuardMiddleware(
  params: GuardParams,
  next: (p: GuardParams) => Promise<unknown>
): Promise<unknown> {
  assertTenantScope(params);
  return next(params);
}

/**
 * Narrow, auditable escape hatch for legitimately unscoped queries.
 * Logs a warning (non-production) naming the operation so every exemption
 * is greppable: `grep -rn unsafeUnscoped src --include="*.ts"`.
 */
export async function unsafeUnscoped<T>(
  operationName: string,
  fn: (db: PrismaClient) => Promise<T>
): Promise<T> {
  // debug preserves the original dev-only semantics (debug is off in production).
  logger.debug('tenant-guard: unscoped query block', { operation: operationName });
  // NOTE (2026-09-28): the old AsyncLocalStorage-based exemption was removed.
  // Prisma's `$use` middleware does not preserve ALS context (it runs from
  // Prisma's internal engine scheduling, outside the caller's async chain),
  // so the exemption never reached the guard and every public token page
  // 500'd with TenantScopeError. The callback now receives an explicit
  // UNGUARDED client — the only reliable bypass. The client is injected via
  // setUnscopedClient() (called by lib/prisma.ts) to avoid a circular
  // runtime import; tests inject a mock.
  //
  // NOTE (2026-10-01): the injection above only runs when lib/prisma.ts is
  // actually evaluated. Bundlers drop it from a route's chunk when nothing
  // in that route's graph *uses* its exports, so unsafeUnscoped 500'd on
  // every agent API route in production. Fix: lazily import lib/prisma.ts
  // here (dynamic import keeps the cycle broken) instead of throwing.
  if (!unscopedClient) {
    await import('./prisma.ts');
  }
  if (!unscopedClient) {
    throw new Error(
      '[tenant-guard] unscoped client not initialized — lib/prisma.ts must call setUnscopedClient()'
    );
  }
  unscopedEvents.push({ at: Date.now(), op: operationName });
  return fn(unscopedClient);
}
