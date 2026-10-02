# EveryJob — System Design

## Problem statement

Solo home-service founders (plumbers, electricians, cleaners — 1–5 person shops in Canada) run their business on paper, texts, and memory. They lose track of jobs, forget to invoice, and have no professional online presence. EveryJob gives them one free place for the whole workflow: schedule jobs, invoice, get paid, collect reviews, and get discovered by homeowners — plus an agent-native layer so a customer's AI assistant can find them and book work.

Tagline: "Every job. One place."

## User roles

| Role | Who | What they do |
|---|---|---|
| **Business owner** (pro) | The shop founder, signed in via business login | Runs everything: jobs, schedule, invoices, payments, customers, marketing, reviews, settings |
| **Customer** (homeowner) | Signed in via customer login, or guest | Books via public booking page, tracks jobs, pays invoices, messages, uses concierge, manages saved pros |
| **Customer's AI assistant** | External agent (e.g. Meta Muse, OpenAI bots) acting via the Agent Protocol | Searches the directory, proposes quote requests — **proposes only, never executes** |
| **Product owner** | Internal (OWNER_EMAILS) | Sees the support inbox, manages tickets |

There is no team/RBAC model: one business = one owner account. Technicians exist as assignable entities, not logins.

## Core user flows

1. **Jobs pipeline**: NEW → SCHEDULED → IN PROGRESS → COMPLETED → PAID (forward-only, plus CANCELLED from any non-PAID state, reopen from CANCELLED). Dispatch board assigns technicians; routes optimizes stop order.
2. **Invoicing & payments**: invoice created (manual, milestone, or batch) → sent/shared → payment recorded (Cash/Interac/Cheque/Stripe/Other) via atomic `recordPayment`. **Marking a job PAID auto-settles the money** (`settleJobPaid`, same transaction): open invoices get a COMPLETED payment for the outstanding balance; a job with no invoice gets a paid invoice + payment created. This keeps "Collected" and monthly revenue in agreement with job-based earnings.
3. **Booking**: public booking page (`/book/[slug]`) → booking request → business confirms → becomes a job. Embeddable; phone display is privacy-gated.
4. **Directory + Agent Protocol**: verified, opted-in pros are listed publicly. Homeowners search by service + city, request quotes (lead drafts for the pro). AI assistants use the machine-readable API (`/.well-known/everyjob.json`, `/api/agent/v1/*`): search → propose (PENDING) → human approves at `/a/[token]` (24h expiry) → quote request + lead draft created atomically. In-app concierge ("Get it done for me") does the same for logged-in customers with an exact preview and explicit send.

## Functional requirements

- Job scheduling, dispatch, and route ordering
- Quotes (with e-signature), invoices (milestone/batch), payment recording
- Customer CRM: contacts, properties, custom fields, tags, portal links
- Public booking page per business; customer portal (jobs, invoices, messages)
- Marketing: campaigns (preview/audience, no auto-send), review requests, reminders, missed-call text-back drafts
- Timesheets, expenses, recurring jobs, pricebook, inventory, equipment, checklist templates
- Reports: revenue, collected, outstanding, win rate, workload
- Integrations: Stripe (Connect + Checkout), Google (Reviews, Calendar), QuickBooks (deferred), WhatsApp/Resend messaging (quota-guarded, consent-gated)
- Agent Protocol v1 + public skills (`public/skills/*/SKILL.md`)

## Non-functional requirements

- **Performance**: server-rendered pages; `connection_limit=1` per instance with retry-on-init-failure (`db-retry.ts`) so the tiny Prisma Postgres role cap survives cold starts. No app-level caching of tenant data.
- **Availability**: single-region Vercel deployment; a DB outage must NEVER look like a logout (unavailable notice, not redirect loop).
- **Security**: fail-closed tenant isolation on every query (see Tenancy); no raw SQL in app code; secrets in env vars only; security headers (HSTS, X-Frame-Options SAMEORIGIN, nosniff); per-action rate limiting (120/min/user); agent endpoints rate-limited per IP with 429 + Retry-After.
- **Data correctness**: one shared tax engine (`calcTax`) for preview == stored; payments transactional (read-check-write atomic); idempotent webhooks and proposal creation.
- **Locale**: Canada-only, CAD-only, English + Canadian French. QST 9.975% on price excluding GST (since 2013-01-01).

## Tenancy model

Multi-tenant by `businessId`. Every tenant-owned table carries `businessId`; a Prisma middleware (`src/lib/tenant-guard.ts`) **fails closed**: any read/write/delete on a tenant model without a non-empty `where.businessId` (or an exempt compound unique key embedding it, e.g. `MessageQuota.businessId_month`) throws `TenantScopeError` before hitting the DB. Creates must carry `businessId` in `data`. Public protocol endpoints with no tenant session use explicit `unsafeUnscoped()` blocks, each labelled with its justification. Customer-scoped models (`SavedPro`, `QuoteRequest`) additionally allow `customerId` scoping.

## Out of scope

- **Dispatch / Equipment / Inventory**: shipped but awaiting an explicit keep / adjust / remove verdict — do not expand.
- QuickBooks sync UI beyond the current connect/disconnect surface.
- Native mobile apps (PWA + push is the $0 answer).
- Multi-seat teams / RBAC; payroll; payroll tax.
- Service areas outside Canada; currencies other than CAD.

## Open questions

1. Money is stored as `Float` with `round2` — should migrate to integer minor units (cents) per best practice; needs a careful migration on live financial data.
2. Tracking-share public links depend on a production Postgres index believed corrupted (`REINDEX INDEX "TrackingShare_token_key"` needed — no DB access from here).
3. File uploads via `@vercel/blob` fail in production with an unknown error; $0 fix not yet found.
4. Google Reviews OAuth needs the production callback registered (done 2026-10-01; verify connect works post-deploy).
5. No staging environment; production is the only deploy target.
