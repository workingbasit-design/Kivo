# EveryJob Truth Audit — Steps 1-3 (read-only)

Generated 2026-10-13. Read-only: no code, config, dependency, or database changes were made.
Repo: ~/workspace/kivo, HEAD 5898475 at time of audit.

---

## Step 1. Stack report

### Framework and versions (from package.json)

| Component | Version | Source |
|---|---|---|
| Next.js | 16.3.6 | package.json `dependencies.next` |
| React | 19.2.8 | package.json `dependencies.react` |
| React-DOM | 19.2.8 | package.json `dependencies.react-dom` |
| TypeScript | ^5 (5.x) | package.json `devDependencies`/`dependencies` |
| Prisma ORM | ^5.22.0 (`@prisma/client`) | package.json |
| Package manager | npm (package-lock.json present; no pnpm-lock.yaml, no yarn.lock) | repo root |
| Language | TypeScript (strict) + App Router | tsconfig / src/app layout |

### Providers and services

| Concern | What is used | Evidence |
|---|---|---|
| Database | Prisma Postgres (Vercel), database `kivo-db` | prisma/schema.prisma (`datasource db provider = "postgresql"`); AGENTS.md |
| ORM / query layer | Prisma Client 5.22, single cached client per serverless instance (`connection_limit=1`), `db-retry.ts` middleware retries pre-execution failures only | src/lib/prisma.ts, src/lib/db-retry.ts |
| Auth | Custom sessions: `kivo_session` cookie → `Session` table; Google OAuth sign-in via `/api/auth/google` + `/api/auth/google/callback` | src/lib/auth.ts:34 (`getSession`), :77 (`requireAuth`); src/app/api/auth/google/route.ts |
| File storage | Vercel Blob (`@vercel/blob` ^2.8.0) — logos, job photos, attachments | package.json; src/app/actions/attachments.ts |
| Email | Resend (free tier), via direct fetch (no SDK in package.json); transactional templates in-house | src/lib/messaging/providers.ts, src/lib/messaging/email-templates.ts |
| SMS | None server-side. `src/lib/sms.ts` builds native `sms:` deep links only; user sends from their own phone plan ($0 forever by design) | src/lib/sms.ts header comment |
| Payments (online) | Stripe Connect-style: `StripeConnection` per business; invoice checkout + deposits via `/api/stripe/*`; app itself records payments as records (no card processing in-app) | src/app/actions/stripe.ts, src/app/api/stripe/webhook/route.ts (signature verified, route.ts:37) |
| AI (Copilot) | Anthropic Claude, optional: `ANTHROPIC_API_KEY` → LLM reply; falls back to deterministic rule-based engine on any failure | src/lib/copilot/anthropic.ts header |
| i18n | Custom, not next-intl: `src/lib/i18n/{en,fr}.ts` + fragments; UI locale `en`/`fr` (en-CA/fr-CA) | src/lib/i18n/ |
| Hosting | Vercel (auto-deploy from GitHub main) | vercel.json, MEMORY.md |
| Analytics | None found (no @vercel/analytics, no PostHog, no Segment in package.json or src/lib) | grep package.json + src/lib — no matches |
| Error tracking | None found (no Sentry SDK in package.json or src) | grep package.json + src/lib — no matches |

### Tests and CI

- Test files: 100 (`ls src/lib/__tests__/*.test.mts | wc -l`), run under plain `node --test` with `register-loader.mjs` (per ~/workspace/kivo/AGENTS.md).
- Test count: **1029 pass, 0 fail** (verified 2026-10-13 via `npm test`).
- CI: exists — `.github/workflows/ci.yml`, job `validate` on push to main + PRs. Steps: `npm ci` → `npm run lint` → `npx tsc --noEmit` → `npm test` → `npm run build`. Node 22.

### Advisory comparison (Next.js / React)

- Installed: Next.js **16.3.6**, React **19.2.8**.
- The prompt's May-2026 premise (13 advisories fixed in 15.5.18/16.2.6) is superseded. Later advisories:
  - **CVE-2026-94545** (Critical 9.5, Sept 22 2026): ImageResponse/Satori SVG RCE — fixed in 16.3.6. App runs exactly the patched version; grep found **zero** `ImageResponse` usage in src/app. Not vulnerable.
  - **CVE-2026-75604** (Critical 9.0, published 2026-10-12): path traversal — fixed in 16.3.3. App already includes it. Not vulnerable.
  - Sept 30 2026 security release **16.3.8** fixes 7 advisories: 1 high (SSRF in Image Optimization, CVE-2026-94483), 5 medium (cache poisoning of self-hosted SSG/ISR x2, metadata image route info disclosure, Draft Mode leak via pending use cache, nested use cache cross-root leak), 1 low (dev-server MCP info disclosure).
- **Exact upgrade needed: 16.3.6 → 16.3.8** (skip 16.3.7, bug-fix only). Do NOT upgrade yet per audit instructions and AGENTS.md (ask before adding/changing dependencies).
- Applicability notes (checked in code): `next.config.ts` sets **no `remotePatterns`** (headers only) — the high-severity SSRF is likely not reachable; app is Vercel-hosted (self-hosted cache-poisoning bugs don't apply per vendor); zero opengraph-image/twitter-image files and zero `draftMode`/`use cache` usage in src/app. Current known exposure appears limited; upgrade warranted for defense in depth.
- React 19.2.8: noted as a current patched line in third-party docs; no specific React advisory found in this pass — **could not verify against official React advisories; re-check before finalizing.**
- Uncertainty: findings come from secondary sources (vendor writeups, security blogs), **not** verified against github.com/vercel/next.js/security/advisories. The full audit should confirm at the official source.

---

## Step 2. Route and permission map

### Page routes (68 total)

Auth model: `src/app/(app)/layout.tsx:29` — `if (!session?.user?.businessId) redirect('/login')`. Every page under `(app)` requires an authenticated **business owner** session. `(auth)` pages are public (login/register/password). `/a/[token]` is token-gated (agent proposal confirmation, 24h expiry).

| Path | Purpose | Who can access | Auth check |
|---|---|---|---|
| `/dashboard` | Business dashboard, stats | Business owner | (app)/layout.tsx:29 |
| `/schedule` | Schedule / calendar view | Business owner | (app)/layout.tsx:29 |
| `/jobs`, `/jobs/new`, `/jobs/[id]`, `/jobs/[id]/edit` | Job list, create, detail, edit | Business owner | (app)/layout.tsx:29 |
| `/money` | Money overview (unbilled, outstanding) | Business owner | (app)/layout.tsx:29 |
| `/invoices`, `/invoices/new`, `/invoices/[id]`, `/invoices/batch` | Invoice list, create, detail, batch invoicing | Business owner | (app)/layout.tsx:29 |
| `/quotes`, `/quotes/new`, `/quotes/[id]`, `/quotes/[id]/sign`, `/quotes/[id]/sign/[requestId]/print` | Quote list, create, detail, e-sign, print | Business owner (sign page: token-gated for clients — verify) | (app)/layout.tsx:29 |
| `/customers`, `/customers/new`, `/customers/[id]` | Customer list, create, detail | Business owner | (app)/layout.tsx:29 |
| `/recurring`, `/recurring/new`, `/recurring/[id]/edit` | Recurring jobs | Business owner | (app)/layout.tsx:29 |
| `/pricebook` | Price book (services) | Business owner | (app)/layout.tsx:29 |
| `/expenses`, `/expenses/new`, `/expenses/[id]` | Job expenses | Business owner | (app)/layout.tsx:29 |
| `/inventory`, `/inventory/new`, `/inventory/[id]` | Parts inventory | Business owner | (app)/layout.tsx:29 |
| `/equipment`, `/equipment/new`, `/equipment/[id]`, `/equipment/[id]/edit` | Equipment | Business owner | (app)/layout.tsx:29 |
| `/timesheets` | Time entries | Business owner | (app)/layout.tsx:29 |
| `/crews`, `/crews/[id]` | Crews | Business owner | (app)/layout.tsx:29 |
| `/projects`, `/projects/new`, `/projects/[id]` | Projects | Business owner | (app)/layout.tsx:29 |
| `/leads` | Lead inbox (directory quote requests) | Business owner | (app)/layout.tsx:29 |
| `/dispatch`, `/routes` | Dispatch / route views | Business owner | (app)/layout.tsx:29 |
| `/tracking` | Live tracking | Business owner | (app)/layout.tsx:29 |
| `/insights`, `/reports`, `/reports/team` | Reports and insights | Business owner | (app)/layout.tsx:29 |
| `/digest`, `/attention` | Morning digest / attention items | Business owner | (app)/layout.tsx:29 |
| `/marketing`, `/marketing/new`, `/marketing/[id]`, `/marketing/[id]/edit`, `/marketing/brand`, `/marketing/reviews` | Marketing surface, brand builder | Business owner | (app)/layout.tsx:29 |
| `/reviews`, `/reminders`, `/notifications` | Reviews, reminders, notifications | Business owner | (app)/layout.tsx:29 |
| `/bookkeeping` | Bookkeeping | Business owner | (app)/layout.tsx:29 |
| `/imports` | CSV/Excel import | Business owner | (app)/layout.tsx:29 |
| `/scenarios` | Scenario/test surface | Business owner | (app)/layout.tsx:29 |
| `/voice` | Voice input surface | Business owner | (app)/layout.tsx:29 |
| `/owner` | Owner settings | Business owner | (app)/layout.tsx:29 |
| `/directory-claims`, `/directory-profile`, `/directory-requests`, `/directory-reports` | Directory listing management | Business owner | (app)/layout.tsx:29 |
| `/settings`, `/settings/team`, `/settings/messaging`, `/settings/payments`, `/settings/integrations`, `/settings/booking`, `/settings/checklists`, `/settings/automations`, `/settings/support` | Settings areas | Business owner | (app)/layout.tsx:29 |
| `/login`, `/register`, `/forgot-password`, `/reset-password/[token]` | Auth (public) | Anonymous | (auth)/layout.tsx (no redirect when logged out) |
| `/a/[token]` | Agent proposal approve/decline (human confirmation) | Anyone with the 256-bit token (24h expiry) | token lookup in page/route — verify file:line |
| `/track/[token]` | Public live-tracking page | Anyone with token | token-gated — verify |
| `/sign/[token]` | Public e-sign page | Anyone with token | token-gated — verify |

### API routes (52 total)

| Path | Methods | Auth / authorization | Evidence |
|---|---|---|---|
| `/api/health`, `/api/health/live` | GET | None (public liveness) | route.ts:8, no auth import |
| `/api/copilot` | GET, POST | Business session (`getSession`) | route.ts:33,136 |
| `/api/export` | GET | Business session | route.ts:20 |
| `/api/attachments/[id]` | (verify) | Business session | route.ts:13 `getSession()` |
| `/api/locations/ping`, `/api/locations/latest` | (verify) | Business session | locations/ping route.ts:34 |
| `/api/push/subscribe`, `/api/push/unsubscribe`, `/api/push/test`, `/api/push/vapid-public-key` | (verify) | Business session (subscribe) | push/subscribe route.ts:28 |
| `/api/integrations/api-keys`, `/api/integrations/webhooks` | (verify) | Business session | route.ts:47 |
| `/api/integrations/quickbooks/connect|callback|disconnect|sync` | GET/POST | Business session + OAuth | filenames; verify per-route |
| `/api/google/connect`, `/api/google/callback` | GET | Business session (connect); OAuth callback | filenames; verify |
| `/api/auth/google`, `/api/auth/google/callback` | GET | Public (OAuth entry) | filenames; verify |
| `/api/cron/messaging`, `/api/cron/recurring`, `/api/cron/workflows`, `/api/cron/digest`, `/api/cron/agent-purge` | GET | `CRON_SECRET` bearer (Vercel cron) | cron/messaging route.ts:21-24 |
| `/api/v1/jobs`, `/api/v1/customers`, `/api/v1/invoices` | GET, POST | API key (`authenticateV1Request`, scopes) | v1/jobs route.ts:11 |
| `/api/agent/v1/proposals`, `/api/agent/v1/proposals/[id]`, `/api/agent/v1/search`, `/api/agent/v1/pros/[slug]` | (verify) | API key / scoped agent credentials | filenames; verify per-route |
| `/api/pay/invoice`, `/api/pay/quote-deposit` | POST | Public; 256-bit token IS the authorization | pay/invoice route.ts:41 comment |
| `/api/sign/[token]` | POST | Token-gated (signature request) | route.ts:32-33 `resolveSignatureRequest(token)` |
| `/api/track/[token]/ping` | GET | Public; unguessable URL token only | route.ts:10-12 comment |
| `/api/tracking/share` | (verify) | Business session (creates share) | filename; verify |
| `/api/stripe/connect`, `/api/stripe/callback`, `/api/stripe/invoice-checkout` | (verify) | Business session | filenames; verify |
| `/api/stripe/webhook` | POST | Stripe signature verification | route.ts:37 `verifyWebhookSignature` |
| `/api/whatsapp/webhook` | GET, POST | `hub.verify_token` + app-secret signature | route.ts:22-28,66 |
| `/api/customers/options` | (verify) | Business session (likely) | verify |
| `/api/imports/template` | (verify) | Business session (likely) | verify |
| `/api/offline-jobs` | (verify) | Business session (likely) | verify |
| `/api/places/search` | (verify) | Business session (likely) | verify |
| `/api/projects/[id]/attachable-jobs` | (verify) | Business session (likely) | verify |
| `/api/reports/run` | (verify) | Business session (likely) | verify |
| `/api/support/ticket` | (verify) | Business session (likely) | verify |
| `/api/admin/migrate-cents` | GET | **NONE FOUND** — no auth check in route.ts (one-time backfill endpoint; flagged 2026-10-13, should be removed) | route.ts:4 `export async function GET()` with no guard |

### Server actions (53 files in src/app/actions/)

All sampled files start with `'use server'`. Auth pattern: `requireAuth()` (src/lib/auth.ts:77, returns `{ businessId, userId }` or throws) or `getSession()` + manual `businessId` check. Tenant scoping enforced app-side by `src/lib/tenant-guard.ts` (fail-closed Prisma middleware over `TENANT_MODELS`, 55 models as of 2026-10-13).

Notable actions: `jobs.ts`, `invoices.ts` (incl. `recordPayment`, `deriveStatus`), `quotes.ts`, `customers.ts`, `payments` (via invoices.ts), `expenses.ts`, `services.ts`, `recurring.ts`, `auth.ts` (login/register), `customer-auth.ts` (customer portal), `portal.ts`, `esign.ts`, `stripe.ts`, `imports.ts`, `batch-invoicing.ts`, `password-reset.ts`, `agent-confirm.ts`, `concierge.ts`.

---

## Step 3. Data model

### Schema overview

- 78 models, 0 enums (statuses are plain `String`), PostgreSQL via Prisma.
- **Row Level Security: not used.** No RLS policies anywhere in prisma/ or src/lib/prisma.ts. Tenant isolation is app-level: `src/lib/tenant-guard.ts` fail-closed middleware (`TENANT_MODELS` set, 55 models) + every tenant query scoping by `businessId`.
- Models **without** `businessId` (identity roots, join tables, token-gated, or global): `User`, `Session`, `PasswordResetToken`, `Business` (tenant root), `InvoiceLineItem`, `JobNote`, `JobPhoto`, `DirectoryRequest`, `QuoteAddon`, `ChecklistTemplateItem`, `JobChecklistItem`, `CustomerFieldValue`, `QuoteLineItem`, `WorkflowEvent`, `WebhookDelivery`, `RateLimit`, `CustomerUser`, `CustomerSession`, `QuoteMessage`, `CustomerAgentKey`, `ConciergeSend`, `ProjectPhase`, `CrewMember`. (Line items / notes / photos scope via their parent's businessId.)
- Indexes: `@@index([businessId])` and compound `@@index([businessId, status])`, `@@index([businessId, date])`, `@@index([businessId, createdAt])` on hot tables (Customer, Job, Invoice, etc.). `@@unique([recurringJobId, date])` on Job. Full list: grep `@@unique\|@@index` in prisma/schema.prisma.
- ON DELETE: predominantly `Cascade` from Business down (e.g. Business → Customer/Job/Invoice/Quote/Service). Job shows `Cascade` + `SetNull` (nullable FKs like customer set null). Check per-relation in schema.

### Money storage (as of 2026-10-13 migration)

Dual-write: legacy `Float` dollars + new nullable `BigInt` cents (`*Cents`), e.g.:

| Model | Float field | Cents field |
|---|---|---|
| Business | `defaultHourlyRate Float?` | `defaultHourlyRateCents BigInt?` |
| Service | `price Float` | `priceCents BigInt?` |
| Job | `price Float` | `priceCents BigInt?` |
| Invoice | `subtotal Float`, `taxAmount Float`, `total Float` (`taxRate Float` is a rate, not money) | `subtotalCents`, `taxAmountCents`, `totalCents` (all `BigInt?`) |
| InvoiceLineItem | `unitPrice Float` | `unitPriceCents BigInt?` |
| Payment | `amount Float` | `amountCents BigInt?` |
| Communication | `estValue Float?` | `estValueCents BigInt?` |
| Quote | `total Float`, `depositAmount Float?`, `discountValue Float?` | `totalCents`, `depositAmountCents`, `discountValueCents` (all `BigInt?`) |
| QuoteLineItem | `unitPrice Float` | `unitPriceCents BigInt?` |
| QuoteDeposit | `amount Float` | `amountCents BigInt?` |
| QuoteAddon | `price Float` | `priceCents BigInt?` |
| RecurringJob | `price Float` | `priceCents BigInt?` |
| JobExpense | `amount Float` | `amountCents BigInt?` |
| ChecklistTemplate | `price Float?` | `priceCents BigInt?` |
| Part | `unitCost Float?` | `unitCostCents BigInt?` |

Example values: `$149.00` → Float `149.0`, BigInt `14900`. Writes convert via `dollarsToCents()` (src/lib/money.ts). Reads still use Float columns in most of the 164 `formatMoney` call sites; `formatCents()`/`formatMoneySmart()` exist for cents-first reads.

### Date and time storage

- Dates: `DateTime` (Postgres timestamptz), e.g. `Job.date`, `Invoice.date`. Stored as UTC instants; displayed in the **business timezone** via `todayInTimezone(timezone, regionCode)` (src/lib/utils.ts; used in src/lib/dashboard.ts:112,290).
- Times: plain `String`, e.g. `Job.time` = `"10:00"` (24h) — normalized by `normalizeJobTime()`; display normalized separately (launch-pack item 2).
- Job `date` is a calendar day (midnight local); overdue compares calendar days, not instants.

### Job status and "overdue" computation

- Stored `Job.status`: `NEW, SCHEDULED, IN PROGRESS, COMPLETED, PAID, CANCELLED` (String, never rewritten by the overdue check).
- `isJobOverdue(status, date, now)` — src/lib/utils.ts:248. True when status is open (`OPEN_JOB_STATUSES`) and the job's calendar day is before today's calendar day. `YYYY-MM-DD` strings are interpreted in **local** time (not UTC midnight) to avoid off-by-one in the evening (utils.ts:258-262).
- `jobDisplayStatus(...)` — src/lib/utils.ts:278. Returns `'LATE'` when overdue, else the stored status. Display-only; the stored status is never rewritten, so the badge auto-heals. **Terminology (2026-10-13): "LATE" for jobs, "Overdue" for invoices.**
- Invoice status: `deriveStatus(total, paid)` — src/app/actions/invoices.ts:338: `PAID` if paid ≥ total − 0.009, `PARTIALLY PAID` if paid > 0, else `UNPAID`. Invoice "overdue" is not a stored status: `OVERDUE_AFTER_DAYS = 30` (src/lib/revenue.ts:21) and workflow trigger `INVOICE_OVERDUE` with default `graceDays: 14` (src/lib/workflows.ts:22,35).

---

*End of Steps 1-3. Steps 4-8 (inventory verification with screenshots, screenshot-issue reproduction, security scan, Jobber gap check, AUDIT.md) are handled separately by the parent agent.*
