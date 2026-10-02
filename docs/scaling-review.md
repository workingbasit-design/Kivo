# Scaling Readiness Review (playbook layer 15b)

Date: 2026-10-02. Scope: statelessness, connection pooling, N+1/indexes,
unbounded queries, heavy sync work, payload sizes. Evidence-based; every
finding cites file:line. Ranked by what breaks first at 10x and 100x current
load. No application code was changed for this review.

## What's already fine

- **Sessions are DB-backed** (`src/lib/auth.ts:41` — `prisma.session.findUnique`).
  No in-memory session state; any instance can serve any request.
- **Connection pooling** (`src/lib/prisma.ts`): `connection_limit=1` per client,
  one client cached on `globalThis` per instance, plus `db-retry.ts` (retries
  pre-execution failures only — writes can't double-apply).
- **Dashboard queries are bounded** (`src/lib/dashboard.ts` `getDashboardStats`):
  `groupBy`, aggregates, `take: 5`. No full-table loads.
- **Agent search is capped** (`src/app/api/agent/v1/search/route.ts:62`,
  `take: 200`).
- **Copilot LLM call has a 10s abort timeout**
  (`src/lib/copilot/anthropic.ts:64`).
- **In-memory caches are bounded** (`src/lib/geofence.ts:110` clears at 2000
  entries; holiday cache is static data with 30-day TTL).
- **Most hot queries have composite indexes**: Job `[businessId, date]`
  (schema.prisma:218), Invoice `[businessId, status]` (schema.prisma:249).

## Breaks first at 10x

### 1. In-memory rate limiter gets WEAKER as you scale
**`src/lib/rate-limit.ts:21`** — buckets live in a per-instance `Map`.
On Vercel serverless every concurrent instance (and every cold start) gets
its own bucket map, so "5 proposals/hour/IP" is really ~5/hour **per
instance**. Traffic growth → more instances → weaker protection, exactly when
abuse risk is highest (proposal spam, quote-request spam, signup abuse).
The file itself documents this as a known pre-scale gap.
Secondary: the prune `setInterval(..., 5*60*1000).unref?.()` (line 32) never
reliably fires on frozen serverless instances — the map grows unbounded in a
long-lived warm instance (memory leak).
**Fix:** move to a shared store before any public scaling — Upstash Redis /
Vercel KV with `@upstash/ratelimit` (the file's own recommendation).

### 2. Synchronous webhook HTTP POSTs inside user requests
**`src/lib/webhooks.ts:139-156`** — after recording a payment or completing a
job, the request thread POSTs to each configured webhook endpoint with
`IMMEDIATE_TIMEOUT_MS = 8000` (line 169). A single slow customer endpoint
hangs the user's payment/completion request up to 8s **per endpoint**,
holding a serverless instance and its one DB connection the whole time.
At 10x, more businesses configure webhooks; one misbehaving receiver can
cascade into connection exhaustion (the exact failure mode `prisma.ts`
documents: "too many connections for role").
**Fix:** enqueue the delivery row (already created at line 110) and return;
let the existing cron retry sweep do the first delivery attempt. Never
`await` third-party HTTP inside a user request.

### 3. Sequential push-notification fan-out inside recordPayment
**`src/lib/webpush.ts:140-143`**, awaited at
**`src/app/actions/invoices.ts:423`** — loops `for (const s of subs)` and
`await`s each HTTPS POST to push services **sequentially**. Latency grows
linearly with device count, inside the payment-recording request.
**Fix:** `Promise.allSettled` the sends (bounded), or move to the same
background queue as webhooks.

## Breaks at 100x

### 4. Unbounded list pages (no pagination)
- `src/app/(app)/customers/page.tsx:34` — `findMany({ where: { businessId } })`
- `src/app/(app)/jobs/page.tsx:30` — `findMany` + `orderBy`, no `take`
- `src/app/(app)/invoices/page.tsx:31,39` — two unbounded `findMany`
- `src/app/(app)/quotes/page.tsx:36,42` — two unbounded `findMany`
Every page load pulls the tenant's entire table into memory and ships it to
the client. At 100x (10k+ rows) this means multi-MB HTML, serverless memory
pressure, and multi-second TTFB on the four most-visited pages.
**Fix:** cursor pagination (`take` + `cursor`), even a simple "load more".

### 5. Session table has no indexes — login does a full scan
**`prisma/schema.prisma:31-36`** — `model Session` has **zero** `@@index`
entries, but:
- `src/lib/auth.ts:11` — every login runs
  `deleteMany({ where: { userId, expiresAt: { lt: now } } })`
- `src/lib/auth.ts:70` — periodic
  `deleteMany({ where: { expiresAt: { lt: now } } })`
- `src/lib/auth.ts:41` — every authenticated request runs
  `findUnique({ where: { id } })` (PK — fine)
At 100x users the Session table is large and **every login** seq-scans it.
**Fix:** add `@@index([userId, expiresAt])` and `@@index([expiresAt])`.

### 6. Invoice/quote number generation full-table-scans per creation
**`src/app/actions/invoices.ts:87`** (`nextInvoiceNumber`) and
**`src/app/actions/quotes.ts:79`** — `findMany({ where: { businessId },
select: { number: true } })` loads **every** invoice/quote number for the
business to compute `max()` in JS. O(n) rows read on every create; a
10k-invoice business reads 10k rows to create invoice 10,001. The clash check
`findFirst({ where: { businessId, number } })` (invoices.ts:95) has no
`[businessId, number]` index either.
**Fix:** `findFirst({ where: { businessId }, orderBy: { number: 'desc' },
take: 1 })` + `@@index([businessId, number])`, or a per-business counter row
updated in the creation transaction.

### 7. Reports aggregates 6 months of rows in JS memory
**`src/lib/dashboard.ts` `getReportStats`** — `payment.findMany` and
`job.findMany` pull **all** payments/jobs in the 6-month window with no
`take`, then bucket/filter/reduce in JS (lines ~340-390). Works at current
scale; at 100x it's tens of thousands of rows per reports-page view.
**Fix:** push aggregation into the DB (`groupBy` by month/status, `_sum`).

### 8. CSV exports buffer the entire dataset in memory
**`src/lib/export.ts:36-103`** — six unbounded `findMany` calls;
**`src/app/api/export/route.ts:38`** builds the whole CSV string, then
returns it in one `NextResponse`. No streaming. At 100x, a large export can
OOM the function (Vercel hobby: ~1 GB).
**Fix:** stream the response (`ReadableStream`) and page the queries
(`cursor`-batched `findMany`).

### 9. Payment history query missing a composite index
`getReportStats` runs `payment.findMany({ where: { businessId,
status: "COMPLETED", createdAt: { gte: rangeStart } } })`, but Payment only
has `@@index([businessId])` (schema.prisma:314). At 100x this scans all of a
business's payments to filter by status/date.
**Fix:** `@@index([businessId, status, createdAt])`.

### 10. Uploads stream through the serverless function
**`src/app/actions/attachments.ts:144`** — `put(pathname, file, ...)` sends
the file **through** the server action to Vercel Blob, not via a presigned
URL direct from the browser (the playbook's 3c pattern). Large uploads
consume function memory/timeout; Vercel request payload limits apply.
**Fix:** server-issued presigned upload URL, browser PUTs direct to Blob.

### 11. Two Prisma clients double per-instance connections
**`src/lib/prisma.ts`** — the guarded client plus `prismaUnscoped` each hold
`connection_limit=1`, i.e. **2 connections per instance**. Necessary today
(middleware can't see ALS context), but at 100x concurrent instances it
doubles pressure on the role's tiny connection cap — the documented
"too many connections for role" failure.
**Fix:** long-term, replace the unscoped client with signed short-lived
token checks inside the guard; short-term, monitor `pg_stat_activity` per
instance count.

## Suggested order of work

1. Shared rate-limit store (abuse protection degrades with scale — do first)
2. Webhook + push delivery out of the request path (latency/cascade risk)
3. Session indexes (one-line schema change, login-path win)
4. Pagination on the four list pages
5. Invoice/quote number lookup fix
6. Reports aggregation + payment composite index
7. Streaming exports, presigned uploads, connection-count monitoring
