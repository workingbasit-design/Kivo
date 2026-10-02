# EveryJob — Caching Strategy

## Principle

Correctness over speed. Tenant data is never cached at a shared layer — a stale or cross-tenant cache entry would be a data leak, and the tenant guard can't protect a cache. We cache only what's safe.

## What is cached, where, TTL, invalidation

| Candidate | Where | TTL | Key | Invalidation |
|---|---|---|---|---|
| Static assets (JS/CSS/fonts) | Vercel CDN, content-hashed filenames | Long (immutable) | content hash | New deploy → new hash |
| Public marketing pages | Vercel CDN / ISR | Default Next.js | path | Redeploy |
| `public/skills/*/SKILL.md` | Vercel CDN (static) | Long | path | Redeploy |
| Authenticated pages/API | **Not cached** | — | — | — |
| Tenant query results | **Not cached** (no Redis) | — | — | — |
| Third-party API results (places, holidays) | In-memory, per-request only | Request scope | — | — |

## Browser caching

Standard Next.js defaults: immutable hashed assets cached long-term; HTML responses revalidated. Authenticated responses carry no-store semantics via server rendering (no static export of private pages).

## Server revalidation

Mutations call `revalidatePath()` on affected routes (jobs, invoices, dashboard, …) so the next render refetches. There is no time-based revalidation of tenant data.

## The rule for any future cache

> Any cache of tenant data MUST include the tenant identifier (`businessId`) in the cache key, and authenticated responses must NEVER be cached at a shared CDN layer.

If Redis is ever added (e.g. for rate-limit counters across instances — currently in-memory, see `rate-limit.ts`), keys are namespaced per business and the tenant-guard test suite gains cache-isolation cases (two orgs, same key shape, never each other's data).
