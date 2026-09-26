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
 * - `Payment` has no businessId column (it hangs off Invoice). Payment
 *   reads must go through invoice ownership checks in app code.
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
  'PushSubscription',
  'QuickBooksConnection',
  'QuickBooksSyncLog',
  'Quote',
  'QuoteDeposit',
  'RecurringJob',
  'Review',
  'ReviewRequest',
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
]);

const unscopedStore = new AsyncLocalStorage<boolean>();

export interface GuardParams {
  model?: string;
  action: string;
  args?: { where?: unknown };
}

/**
 * Pure decision function — no Prisma import, directly unit-tested.
 * Throws TenantScopeError for unscoped tenant queries; returns void otherwise.
 */
export function assertTenantScope(params: GuardParams): void {
  const { model, action } = params;
  if (!model || !TENANT_MODELS.has(model)) return;
  if (!GUARDED_ACTIONS.has(action)) return;
  if (unscopedStore.getStore() === true) return;
  const where = params.args?.where as Record<string, unknown> | undefined;
  const businessId = where?.businessId;
  if (typeof businessId !== 'string' || businessId.length === 0) {
    throw new TenantScopeError(model, action);
  }
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
export function unsafeUnscoped<T>(operationName: string, fn: () => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[tenant-guard] unscoped query block: ${operationName}`);
  }
  return unscopedStore.run(true, fn);
}
