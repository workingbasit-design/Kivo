# 0001 — Fail-closed tenant guard

Date: 2026-09-26 (hardened through 2026-10-01)

## Context

EveryJob is multi-tenant: many businesses share one Postgres database. The classic SaaS vulnerability is IDOR/broken object-level authorization — a user from business A fetching business B's data by changing an ID. With dozens of server actions written over time, relying on every developer remembering `where: { businessId }` on every query is fragile; two real production crashes (2026-10-01, dispatch + messaging) proved even reads/writes get missed.

## Decision

A Prisma middleware (`src/lib/tenant-guard.ts`) **fails closed**: any `find*/update*/upsert/delete*/count/aggregate/groupBy/create` on a tenant-owned model without a non-empty `where.businessId` (or `data.businessId` for creates) throws `TenantScopeError` before the query reaches the database. Compound unique keys embedding a non-empty `businessId` (e.g. `MessageQuota.businessId_month`, `MessagingConnection.businessId_channel`) are explicitly exempt since Prisma requires the compound input. Customer-scoped models (`SavedPro`, `QuoteRequest`) also accept `customerId`. Public endpoints with no tenant session use labelled `unsafeUnscoped()` blocks.

## Alternatives considered

- **Code review discipline only**: rejected — the two 2026-10-01 crashes were exactly this failure mode, caught only by live QA.
- **Row-level security (Postgres RLS)**: stronger in theory, but harder to debug and test with Prisma middleware in play; deferred.
- **Separate database per tenant**: operationally infeasible on the free tier.

## Consequences

- Positive: cross-tenant leaks are structurally near-impossible; the 2026-10-01 crashes became loud failures instead of silent data leaks; attack-suite tests (`tenant-isolation.test.mts`) prove fail-closed behavior.
- Negative: legitimate compound-key and public-endpoint queries need explicit exemptions/`unsafeUnscoped` — each is a small, reviewable carve-out.
- Every new Prisma model must be classified into `TENANT_MODELS` or left out deliberately; a test asserts the set stays in sync with the schema.
