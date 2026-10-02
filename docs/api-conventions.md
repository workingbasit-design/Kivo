# EveryJob — API Conventions

Two surfaces, one set of rules.

## URL style

- **Mutations**: Next.js Server Actions (`src/app/actions/*.ts`, one file per domain: `jobs.ts`, `invoices.ts`, …). Called from client components via `useActionState`; redirect or revalidate on success.
- **Reads & public surface**: `/api/*` routes —
  - `/api/agent/v1/*` — Agent Protocol (search, pros, proposals)
  - `/api/v1/*` — versioned REST (customers, jobs, invoices) for integrations
  - `/api/stripe/*`, `/api/whatsapp/*`, `/api/google/*` — provider webhooks/OAuth
  - `/api/cron/*` — scheduled triggers (guarded by `CRON_SECRET`)
  - `/api/health`, `/api/health/live` — monitoring
- Public share links use unguessable tokens in the path (`/track/[token]`, `/sign/[token]`, `/a/[token]`, `/p/[token]`), never sequential IDs.

## Error format

Single shape everywhere:

- Server Actions return `{ error: "human message" }` on failure, `{ ok: true, … }` on success (typed per domain, e.g. `JobActionResult`). They **never throw** on the write path — an unhandled throw renders a full error page instead of the inline error + toast the UI shows.
- API routes return `NextResponse.json({ error: "message" }, { status })`, with optional `details` (zod field errors) or `code` (e.g. `idempotency_key_retired`).

## Validation

Zod schemas in `src/lib/validations.ts`, parsed **at the boundary** (top of every action/route) with `safeParse`. Invalid input → `{ error }` / 400, never a stack trace. Money amounts are coerced and rounded to 2 decimals at parse time.

## Auth & org context

- Pages/actions: `requireAuth()` → `{ user, businessId }` (redirects to `/login` if not signed in; throws `DatabaseUnavailableError` instead of lying "logged out" when the DB is unreachable).
- API routes: call `getSession()` directly and return **401 JSON** (never redirect).
- Customer portal: separate customer session (`getCustomerSession`).
- Every tenant query scopes by `businessId`; the tenant-guard middleware enforces it fail-closed (see `docs/decisions/0001-*`).

## Pagination

**Gap**: list endpoints are generally *not* paginated — pages load full lists (only isolated `take: 25` caps exist, e.g. Stripe event lists). Fine at current scale (solo shops); cursor pagination must be added before any list can grow unbounded.

## Status codes

| Code | Used for |
|---|---|
| 200 | Reads, successful idempotent replays |
| 201 | Created (proposals, API keys) |
| 400 | Validation failure, missing/invalid idempotency key, bad JSON |
| 401 | No/invalid session or agent key (API routes) |
| 403 | Valid identity, insufficient scope/permission |
| 404 | Unknown resource — also used for cross-tenant misses (never 403, to avoid oracle leaks) |
| 410 | Retired idempotency key (send a new one) |
| 429 | Rate limited — always with `Retry-After`; per-user action limit 120/min, agent search 60/min/IP, proposals 5/hour/IP |
| 503 | `/api/health` when the DB is unreachable |

## Idempotency

Anything unsafe to repeat is idempotent: Stripe webhooks via stored event IDs, proposal creation via mandatory `Idempotency-Key`, `recordPayment` via an atomic read-check-write transaction, concierge sends via exact replay identity.
