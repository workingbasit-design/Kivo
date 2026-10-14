# Prompt 3, Part A — Database hardening plan

Status: PLAN — waiting for user OK before any implementation.
Scope: local and staging only. No production migrations, seeds, or tests.
Source of truth for current schema: `prisma/schema.prisma` (79 models, 1,518 lines, read 2026-10-14).
Related: `docs/AUDIT.md`, `docs/plans/part-a.md`, money migration (Float → cents, Phases 3–5 still open).

## A0. Current schema (from the audit + live read)

- **Stack:** Prisma 5.22 + PostgreSQL (Prisma Postgres / Vercel), server-only access. No Supabase, no direct client DB access, no `anon` key. The A3 Supabase branch does NOT apply; the ORM branch applies.
- **Tenancy today:** app-level only. `src/lib/tenant-guard.ts` is a Prisma middleware that FAILS CLOSED when a query against a model in `TENANT_MODELS` lacks top-level `where.businessId`. Escape hatch `unsafeUnscoped()` (AsyncLocalStorage) for token lookups, webhooks, admin views. Zero raw SQL in the codebase (`$queryRaw`/`$executeRaw` unused) — the guard covers all Prisma queries.
- **Identity today:** `User` has a single `role` string (default `"ADMIN"`) and nullable `businessId`. No memberships table. A user belongs to at most one business, and role is a single global value, not per-business.
- **Consumer vs business-customer:** already separate models. `CustomerUser` (directory account: email, password, saved pros, quote requests) vs `Customer` (a business's contact record, `businessId`-scoped). No link between them today — A2's "explicit, optional relationship" does not exist yet.
- **Money:** dual-write Float + `*Cents` BigInt on 15 models. Reads still use Float. Backfill has NOT run. `Quote.discountValue` is ambiguous (percent OR CAD by `discountType`) — backfill must not blindly multiply by 100. `Payment.businessId` is still NULLABLE ("during backfill, then required").
- **Status values:** all `String`, zero enums. No DB CHECK constraints on any status, amount, or quantity.
- **Numbering:** `Invoice.number` and `Quote.number` are plain strings. NO unique constraint on `(businessId, number)` — duplicates are possible today. Numbers are generated in app code without a row lock.
- **Time:** `Business.timezone` exists (nullable, default `America/Toronto`). `Job.startAt`/`endAt`/`timeTbd` exist. `RecurringJob` still has a text `time` field. `Job.date` (legacy) still exists alongside `startAt`.
- **Audit:** `PiaAuditLog` exists but covers only PII view/export/search (no before/after, no IP/UA, no money/void/delete/role events, no append-only protection).
- **Idempotency:** per-entity only (`Job.idempotencyKey`, `AgentProposal.idempotencyKey`, `ConciergeSend.idempotencyKey`, `StripeEvent.stripeEventId`, `MessageLog.eventKey`). No generic `idempotency_keys` table, no generic `webhook_events` table (Stripe-only).
- **Tax:** `Invoice.taxRate` (Float) + `taxType` (string: GST/HST/PST/…). No `tax_rates` table, no snapshots on lines, no QST number / filing frequency / registered flags on `Business`. `Business.taxId` holds the GST/HST number.
- **FK deletes:** mixed. Part A7 made Invoice/InvoiceLineItem/Payment/CreditNote `Restrict`. Everything else is mostly `Cascade` (e.g. deleting a Business cascades to customers, jobs, invoices — via Customer cascade; deleting a Customer cascades to jobs/invoices/quotes).
- **Audit columns:** `createdAt`/`updatedAt` everywhere. `created_by`/`updated_by`: mostly absent (only `JobNote.authorId`, `JobPhoto.uploadedById`, `Attachment.uploadedById`). `archived_at`: only `Customer.archivedAt`. No `archived_by` anywhere.
- **Secrets at rest:** `GoogleConnection` + `QuickBooksConnection` OAuth tokens are PLAINTEXT in DB. `MessagingConnection` tokens are AES-256-GCM encrypted. `ApiKey`/`CustomerAgentKey`/tokens are SHA-256 hashes (good).
- **Environments:** dev/staging/production separation is NOT established — one Prisma Postgres DB is used. No restore drill has ever been run. No staging seed script exists.

## A1. Migration order

All migrations go through Prisma (`prisma migrate dev` locally → `prisma migrate deploy` on staging). Never hand-edit the DB. Each migration is its own commit, with a down/rollback note below. Order matters: foundations first, constraints last (constraints must not fail on existing dirty rows — clean data first, then constrain).

| # | Migration | Contents | Depends on |
|---|-----------|----------|------------|
| M1 | `memberships` | New `Membership` table (see A2). Backfill: one row per existing `User` with `businessId` (role mapped from `User.role`, status ACTIVE). Do NOT drop `User.role`/`User.businessId` yet — dual-read during rollout, drop in M9. | — |
| M2 | `consumer_link` | New `CustomerLink` table (see A2): optional explicit link `CustomerUser` ↔ `Customer`. No backfill (no link exists today; links are created only by explicit user action). | — |
| M3 | `tax_rates` | New `TaxRate` table + seed rows (see A5). New `InvoiceTaxLine` table (document tax-line snapshots). Add `Business.gstHstRegistered`, `Business.qstNumber`, `Business.filingFrequency`. | — |
| M4 | `counters` | New `DocumentCounter` table (see A6): one row per (business, document type), `nextNumber`. Backfill: max existing number per business per type, so the next number never collides. | — |
| M5 | `audit_events` | New `AuditEvent` table (see A8) + `audit_events_no_update_delete` trigger + RLS-style policy note. Migrate `PiaAuditLog` rows? No — keep `PiaAuditLog` as-is (PII view log), `AuditEvent` is the new general log. Both coexist. | — |
| M6 | `idempotency_webhooks` | New `IdempotencyKey` + `WebhookEvent` tables (see A10). Backfill `WebhookEvent` from `StripeEvent` (Stripe events only, marked provider=STRIPE). Keep `StripeEvent` during rollout, deprecate after. | — |
| M7 | `privacy` | New `ConfidentialityIncident` table (see A11). Add `Customer.archivedBy`, `Job.archivedAt`/`archivedBy`, `Equipment.archivedAt`/`archivedBy`. Add `createdBy`/`updatedBy` to the 12 business tables that lack them (list in A4). | M1 (actor = membership user) |
| M8 | `cents_cutover` | Finish the money migration: backfill all `*Cents` (with the `Quote.discountValue` PERCENT guard), make `*Cents` NOT NULL, switch reads to cents, drop Float columns. **This closes the open money-migration Phases 3–5.** Order note: runs BEFORE M10 constraints (amount_cents >= 0 needs clean cents data). | — |
| M9 | `tenancy_notnull` | `Payment.businessId` NOT NULL (after M8 backfill). `Business.timezone` NOT NULL (default `America/Toronto`). Drop `User.role` + `User.businessId` (replaced by Membership). Drop legacy `Job.date`/`Job.time` (replaced by `startAt`/`endAt`/`timeTbd`) — only after confirming no code reads them. | M1, M8 |
| M10 | `constraints` | CHECK constraints (amount_cents >= 0, quantity > 0, status lists, deposit <= total, payment > 0). UNIQUE `(businessId, number)` on invoices + quotes + credit notes. ON DELETE RESTRICT on the A4 list. FK indexes (see A9). | M4 (numbers unique first), M8 (cents first) |
| M11 | `rls` | Postgres RLS as second line of defence (see A3). Applied LAST: RLS must not break the app, and it is verified against the already-migrated schema. | M1–M10 |
| M12 | `indexes` | Composite indexes for main screens (see A9). Separate migration so EXPLAIN ANALYZE before/after is measured on the final schema. | M10 |

Rollback per migration: each migration ships with a `ROLLBACK.md` note (reverse SQL). Prisma migrate has no automatic down-migration — rollback = apply the recorded reverse SQL + redeploy the previous code. For M8 (cents cutover) and M9 (column drops), rollback requires the previous release's code AND a data check that no cents-only writes happened after cutover. Data-destroying steps (dropping Float columns, dropping `Job.date`) get a 7-day waiting period on staging before they run on production — production is NOT in scope for this prompt, but the plan records the rule.

## A2. Tenancy and roles

**Memberships table** (`Membership`):
- `id`, `userId` → `User` (Cascade), `businessId` → `Business` (Cascade), `role` (CHECK: `OWNER | ADMIN | DISPATCHER | TECHNICIAN`), `status` (CHECK: `ACTIVE | INVITED | SUSPENDED | REMOVED`), `invitedById` (nullable), `createdAt`, `updatedAt`.
- UNIQUE `(userId, businessId)` — one membership per user per business.
- Index `(businessId, status)`, `(userId)`.
- Backfill: every `User` with non-null `businessId` gets a Membership with `role = User.role` mapped (`OWNER`→OWNER, `ADMIN`→ADMIN, others→TECHNICIAN) and `status = ACTIVE`. Users with null `businessId` (not yet onboarded) get none.

**Permission checks use Membership, never `User.role`.** New helper `requireMembership(businessId, ...allowedRoles)` replaces `requireAuth()`-only checks in server actions. Role semantics (minimum viable, to be confirmed in review):
- OWNER: everything, incl. team management, billing, Stripe Connect, settings, delete/void.
- ADMIN: everything except team role changes and Stripe Connect.
- DISPATCHER: jobs, schedule, customers, quotes, invoices (create/send), no money settings, no team, no void.
- TECHNICIAN: own assigned jobs, job notes/photos/checklist, time entries; read-only on customers/jobs otherwise; no money, no settings.

**Consumer vs business-customer (explicit, optional link):**
- `CustomerLink`: `id`, `customerUserId` → `CustomerUser` (Cascade), `customerId` → `Customer` (Cascade), `businessId` → `Business` (Cascade), `createdBy` (membership user or customer), `createdAt`. UNIQUE `(customerUserId, customerId, businessId)`.
- Links are created ONLY by: (a) the customer tapping "This is me" on a portal page and confirming, or (b) the business owner linking after the customer confirms. Never auto-matched by email/phone. Deleting either side removes the link (Cascade). No data is merged by linking — it only grants the consumer portal access to that business's records for that customer.

## A3. Database-level isolation

**Decision: ORM branch (Prisma, server-only).** The app uses Prisma with server-only access; there is no Supabase, no anon key, no direct client DB access. The Supabase RLS branch does not apply.

**Line 1 — data-access layer (already exists, to be completed):** `src/lib/tenant-guard.ts` (Prisma middleware, fail-closed on missing `businessId`) + `src/lib/job-queries.ts` (shared queries) + per-domain `src/lib/*.ts`. Rule: no route handler or server action queries Prisma directly — all queries go through a `src/lib/*` function that takes `businessId` (or membership) as its first argument. Enforcement: lint rule / code review + the tenant guard as backstop. Gap to close in implementation: grep for `prisma.` calls outside `src/lib/` and move them.

**Line 2 — Postgres RLS via per-request setting (RECOMMENDED, with a staging gate).** Use `set_config('app.business_id', '<id>', true)` inside each transaction (local to the transaction, so concurrent requests cannot leak), plus `ENABLE ROW LEVEL SECURITY` + policies on every business table: `USING (business_id = current_setting('app.business_id', true))` for SELECT/UPDATE/DELETE, `WITH CHECK (business_id = current_setting('app.business_id', true))` for INSERT/UPDATE.
- Why: if app code ever misses a filter, the DB still refuses. This is the point of Prompt 3.
- Risk: Prisma connection pooling + middleware retries. `set_config(..., true)` is transaction-local, so it is safe with pooling as long as it is set at transaction start (Prisma `$transaction`). A failed transaction rolls back the setting. The staging gate: implement on 3 tables first (Job, Invoice, Customer), run the full test suite + a manual QA pass, then roll out to all business tables.
- If the staging gate fails (Prisma transaction + `set_config` proves unreliable on Prisma Postgres), fallback = keep line 1 + a CI test that asserts every query in `src/lib/` passes `businessId` (static check), and document the decision in `docs/SECURITY_REPORT.md`. Either way, the choice is explained.
- Tables WITHOUT `businessId` (join tables, token tables with `businessId` — most have it) get policies via their parent: e.g. `InvoiceLineItem` via `invoice.businessId` (subquery policy). Tables with no business link at all (`RateLimit`, `DirectoryRequest`, `SupportTicket` with null business) get: no RLS (documented), or a policy that allows only the service role. `User`/`Session`/`PasswordResetToken` are identity roots — no RLS, access only via auth code path.
- The DB user the app connects as must NOT be a superuser / table owner, or RLS is bypassed (table owners bypass RLS by default — use `FORCE ROW LEVEL SECURITY` on every table to close that hole).

## A4. Constraints that make bad data impossible

- **NOT NULL:** `Payment.businessId`, `Business.timezone`, all `*Cents` (after M8 backfill), `Invoice.number`, `Quote.number`, `CreditNote.number` (new — credit notes need numbers per A6).
- **CHECK constraints** (new, via Prisma `@@check` where supported, else raw SQL in the migration):
  - `amount_cents >= 0` on Invoice subtotal/tax/total, Payment, Quote total/deposit, Job price, Expense, QuoteDeposit, Part unitCost, CreditNote.
  - `quantity > 0` on InvoiceLineItem.qty, QuoteLineItem.qty, Part.quantity >= 0 (stock can be 0, not negative).
  - Status CHECKs (explicit allowed lists — these replace the zero-enum String columns with DB-enforced values): Job (`NEW|SCHEDULED|IN PROGRESS|COMPLETED|PAID|CANCELLED`), Invoice (`UNPAID|PARTIALLY PAID|PAID|VOID`), Quote (`DRAFT|SENT|APPROVED|DECLINED`), Payment (`PENDING|COMPLETED|FAILED|VOID`), CreditNote (no status — immutable once created).
  - `deposit_cents <= total_cents` on Quote, `payment amount > 0` on Payment/QuoteDeposit.
  - `taxRate`/`discountValue` ranges: `discountValue` 0–100 when `discountType = PERCENT`.
  - **Note:** Invoice status needs `VOID` added (today void is a `voidedAt` timestamp + status stays UNPAID/PAID — the voided exclusion is done in query code. The CHECK list must include VOID only if implementation also sets `status='VOID'` on void; plan decision: set status to VOID on void for a single source of truth, keep `voidedAt`/`voidReason` as the audit fields).
- **UNIQUE:** `(businessId, number)` on Invoice, Quote, CreditNote. (Requires M4 counters + a dedupe pass on existing rows — any duplicate numbers found in staging data are listed and renumbered with owner confirmation before the constraint is applied. Production data is out of scope.)
- **ON DELETE RESTRICT:** Invoice.customer, Invoice.business, InvoiceLineItem.invoice, Payment.invoice, Payment.business, CreditNote.invoice, CreditNote.business, InvoiceTaxLine.invoice. (Invoice→Job stays SetNull. Customer→Business stays Cascade only via the archive path — hard-deleting a Business is an admin-only operation that must explicitly purge dependents; the plan records this as an intentional exception with a purge procedure, not a silent cascade.)
- **Audit columns:** `archived_at` + `archived_by` on Customer (archivedBy new), Job, Equipment. `created_at`/`updated_at` already everywhere (add `updated_at` trigger — Prisma `@updatedAt` handles it in app code; a DB trigger is belt-and-braces and is added for tables written by raw SQL, of which there are none — so: NO trigger, document that `@updatedAt` is the mechanism). `created_by`/`updated_by` added to: Job, Invoice, Payment, Quote, CreditNote, Customer, Lead, Expense, TimeEntry, Project, QuoteDeposit, MessageLog. Values = `User.id` of the acting membership user; system/cron writes use `createdBy = 'system'`.
- **FK indexes:** every FK gets an index (see A9 — most exist; the plan lists the missing ones found by audit: `JobNote.authorId`, `JobPhoto.uploadedById`, `ChecklistTemplateItem.templateId`, `QuoteAddon.quoteId`, `JobChecklistItem.jobId`, `Notification.businessId` (exists), `WorkflowEvent.ruleId` (exists via relation? verify in implementation)).

## A5. Money and tax

- **All amounts in bigint cents.** M8 completes the cutover (see A1). After M8: Float columns dropped, reads use `*Cents`, `formatCents()` everywhere. `Quote.discountValue` guard: when `discountType = PERCENT`, `discountValueCents` stays NULL and `discountValue` (percent) is kept as a decimal percent — percent is NOT money and must never be multiplied by 100. When `discountType = AMOUNT`, `discountValueCents = round(discountValue * 100)`.
- **`tax_rates` table** (`TaxRate`): `id`, `jurisdiction` (province/territory code: AB, BC, MB, NB, NL, NS, NT, NU, ON, PE, QC, SK, YT), `taxType` (CHECK: GST|HST|PST|RST|QST), `rateBps` (Int, basis points — 500 = 5%, 9975 = 9.975%), `effectiveFrom` (Date), `effectiveTo` (Date, nullable = still in force), `createdAt`. UNIQUE `(jurisdiction, taxType, effectiveFrom)`. **Rates are immutable: never UPDATE a row. Corrections = insert a new row with a new `effectiveFrom` and close the old row's `effectiveTo`.** Test: a test that inserts a rate, attempts an UPDATE, and asserts it fails (enforced by a trigger `tax_rates_no_update` + the test asserts the trigger fires). Seed rows (general rates, 2026):
  - AB, NT, NU, YT: GST 500
  - BC: GST 500 + PST 700
  - MB: GST 500 + RST 700
  - SK: GST 500 + PST 600
  - ON: HST 1300
  - NB, NL, PE: HST 1500
  - NS: HST 1500 with `effectiveTo = 2025-03-31`, HST 1400 with `effectiveFrom = 2025-04-01`
  - QC: GST 500 + QST 9975 (QST base = price BEFORE GST — the tax calculator must implement this, and the test asserts QST is computed on the pre-GST base)
- **`docs/TAX_NOTES.md`:** states the owner must verify all rates and the PST taxability of services with an accountant before launch; lists the seed rates + sources (CRA/Revenu Québec); notes QST-on-pre-GST rule; notes PST/RST/QST generally apply to goods and some services — service taxability varies and is NOT decided by this code.
- **Snapshots:** `InvoiceLineItem` + `QuoteLineItem` store `taxRateBps` + `taxType` at creation. New `InvoiceTaxLine`: `id`, `invoiceId` (Restrict), `taxType`, `rateBps`, `baseCents`, `amountCents`. Sent documents render ONLY from these snapshot rows — changing `TaxRate` later never changes a sent document. Test: create invoice, change tax rate table, re-render invoice, assert totals unchanged.
- **Business tax settings:** add `gstHstRegistered` (Boolean, default false), `qstNumber` (String, nullable), `filingFrequency` (String, CHECK: MONTHLY|QUARTERLY|ANNUAL, nullable). `taxId` (GST/HST number) already exists. Settings UI: show the tax number fields only when registered = yes. Invoices show tax lines only when the business is registered (unregistered businesses must not charge/collect tax — the invoice builder enforces this server-side).

## A6. Numbering

- **`DocumentCounter`:** `id`, `businessId` (Cascade), `docType` (CHECK: QUOTE|INVOICE|CREDIT_NOTE), `nextNumber` (Int, starts at 1), `prefix` (String, e.g. `INV-`, `QUO-`, `CN-`), `updatedAt`. UNIQUE `(businessId, docType)`.
- **Generation:** inside the same transaction as the document insert: `SELECT * FROM "DocumentCounter" WHERE businessId = ? AND docType = ? FOR UPDATE` → read `nextNumber` → format (`INV-0001`, zero-padded to 4, grows beyond 9999) → insert document → `UPDATE counter SET nextNumber = nextNumber + 1`. Row lock serializes per (business, type) — no duplicates, no gaps skipped by contention (gaps only from rolled-back transactions, which is acceptable and documented).
- **Concurrency test:** `scripts/test-numbering-concurrency.mts` (or a vitest/node test): 20 parallel `createInvoice` calls for one business → assert 20 distinct numbers, sequential with no duplicates. Runs against a local Postgres (testcontainers NOT available — use the local dev DB in a scratch schema, or a Prisma transaction-level mock; the plan records that the test needs a real Postgres and runs in CI against the CI Postgres service).
- **Credit notes get numbers:** `CreditNote.number` (String, e.g. `CN-0001`) via the same counter.

## A7. Time

- `Business.timezone` (IANA) already exists; M9 makes it NOT NULL with default `America/Toronto`. Settings UI already edits it (verify in implementation).
- `Job.startAt`/`endAt` (timestamptz) + `timeTbd` already exist. M9 drops legacy `Job.date`/`Job.time` after a code grep proves no reads remain. `RecurringJob.time` (text) → convert to `startTime` (HH:mm string) + keep `nextRun` as timestamptz; the recurring generator computes occurrences in the business timezone.
- **Rule:** every "today / this week / late / overdue" query takes `timezone` as an input (already the pattern in `job-queries.ts` + `isJobLate` — implementation extends it to ALL remaining queries: dashboard attention, reports, digest, recurring generator). No `new Date()`-based day boundaries in server code — all day math goes through the business timezone helper. Test: same instant evaluated in America/Toronto vs America/St_Johns gives different "today" (existing Part A test pattern, extended).

## A8. Audit log

- **`AuditEvent`:** `id`, `businessId` (Cascade), `actorId` (User id, or `system`), `actorType` (CHECK: USER|SYSTEM|WEBHOOK|COPILOT), `action` (CHECK list below), `entityType` (String), `entityId` (String, nullable), `beforeJson` (String JSON, nullable), `afterJson` (String JSON, nullable), `ip` (String, nullable), `userAgent` (String, nullable), `createdAt` (default now). Index `(businessId, createdAt)`, `(businessId, entityType, entityId)`.
- **Actions (CHECK list):** `MONEY_CREATE|MONEY_UPDATE|MONEY_VOID|INVOICE_SEND|PAYMENT_RECORD|PAYMENT_VOID|CREDIT_NOTE_CREATE|DELETE|ARCHIVE|RESTORE|ROLE_CHANGE|TEAM_INVITE|TEAM_REMOVE|SETTINGS_CHANGE|PAYOUT_EVENT|WEBHOOK_EVENT|COPILOT_ACTION|LOGIN|LOGOUT|PASSWORD_CHANGE|EXPORT|IMPORT|CONSENT_CHANGE`.
- **Append-only:** DB trigger `audit_events_block_mutation` raises on UPDATE/DELETE; plus a Postgres policy denying UPDATE/DELETE (defence in depth). Owners read their own business's events via a new `/audit` page (list + filter by action/entity/date). `PiaAuditLog` stays for PII view/export/search.
- **Secrets scrubbing:** `beforeJson`/`afterJson` go through a scrubber that redacts keys matching `*token*|*secret*|*password*|*key*|*hash*` (case-insensitive) + any value that looks like a bearer token. Test: write an event containing a fake token, assert the stored JSON contains `[REDACTED]`.
- **Write sites (implementation checklist):** invoice create/update/void/send, payment record/void, credit note create, customer archive/restore/delete, job delete, role change, team invite/remove, settings save, Stripe webhook receipt, Copilot tool calls, export/download. Each write is in the SAME transaction as the action it logs.

## A9. Indexes

- **FK indexes:** every FK column indexed (list the missing ones found in A4; verify each in implementation).
- **Composite indexes for main screens:**
  - Job: `(businessId, status, startAt)`, `(businessId, customerId, startAt)` — replaces/augments existing `(businessId, status, date)` (which references the legacy `date` column — dropped in M9, index recreated on `startAt`).
  - Invoice: `(businessId, status, dueAt)` — requires adding `Invoice.dueAt` (DateTime, nullable; due date = sent date + terms; M10 adds the column, backfilled from `date + 30 days` for sent invoices, null for drafts).
  - Payment: `(businessId, invoiceId, createdAt)`, `(businessId, status)`.
  - Quote: `(businessId, status, createdAt)` (exists — verify).
  - Customer: `(businessId, archivedAt, name)` for list filtering.
  - MessageLog: `(businessId, eventKey)` (exists), `(businessId, createdAt)` (exists).
- **10,000-job seed + EXPLAIN ANALYZE:** `scripts/seed-perf.ts` seeds 10,000 jobs (+ realistic customers/invoices) into a scratch local DB. `scripts/explain-perf.sql` runs EXPLAIN ANALYZE for the 10 most common queries (dashboard today, schedule week, jobs list by status, money outstanding, customer jobs, invoice list, quote list, attention list, search customers, reports revenue). Output saved to `docs/PERF.md` as before/after (before = current indexes, after = M12 indexes). Target: every query < 50ms on the seeded DB, no Seq Scan on a business table.

## A10. Idempotency

- **`IdempotencyKey`:** `id`, `businessId` (Cascade, nullable for pre-auth endpoints like public quote requests — null business means key scoped by endpoint + caller), `key` (String, client-supplied UUID), `endpoint` (String, e.g. `POST /api/payments`), `responseJson` (String, nullable — the stored response for replays), `statusCode` (Int, nullable), `createdAt`, `expiresAt` (24h). UNIQUE `(businessId, endpoint, key)` + UNIQUE `(endpoint, key)` for null-business rows (partial unique index — Prisma: implement via raw SQL in migration).
- **Behavior:** payment + message-send endpoints require `Idempotency-Key` header (UUID). First call executes and stores the response; replay with the same key returns the stored response WITHOUT re-executing. Keys expire after 24h. Test: double-submit a payment with the same key → one Payment row, same response.
- **`WebhookEvent`:** `id`, `provider` (CHECK: STRIPE|QUICKBOOKS|RESEND|META), `providerEventId` (String), `businessId` (nullable — webhooks may arrive before business resolution), `type`, `payloadJson`, `processedAt` (nullable), `createdAt`. UNIQUE `(provider, providerEventId)`. Handler: insert (on conflict → skip), process, set `processedAt`. `StripeEvent` is migrated into this table (M6) and then deprecated (kept read-only for 30 days, then dropped in a follow-up).
- **Existing per-entity keys stay:** `Job.idempotencyKey`, `AgentProposal.idempotencyKey`, `ConciergeSend.idempotencyKey` — they are domain-level dedupe and are not replaced.

## A11. Privacy and retention

- **`docs/DATA_RETENTION.md`:** account deletion procedure — (1) personal data (name, email, phone, address, messages, notes) deleted or anonymized within 30 days of a verified deletion request; (2) financial documents (invoices, payments, credit notes, tax lines) kept 6 years (CRA requirement) with ONLY the fields needed for tax/audit (customer name + address + amounts + tax numbers — phone/email/notes stripped); (3) anonymization = replace PII with `deleted-<id>` placeholders, keep FK structure; (4) deletion is a membership-owner-only action + confirmation + audit event. Consumer (`CustomerUser`) deletion: profile + messages + saved pros deleted; quote requests anonymized (business keeps the service/description for its records, customer name/email replaced).
- **Data export:** business export = all business data as JSON (one file per model) + CSV for customers/jobs/invoices/payments, from a new `/settings/export` action (owner-only, audit-logged, rate-limited to 1/day). Consumer export = profile + quote requests + messages + saved pros as JSON, from account settings. Both are generated server-side, never via client-side assembly.
- **`ConfidentialityIncident`** (Quebec Law 25 register): `id`, `businessId` (Cascade, nullable for platform-level incidents), `occurredAt`, `discoveredAt`, `summary`, `dataTypes` (JSON array), `affectedCount` (Int, nullable), `notifiedCommission` (Boolean), `notifiedAffected` (Boolean), `measuresTaken`, `status` (CHECK: OPEN|CONTAINED|CLOSED), `createdBy`, `createdAt`. Plus `docs/INCIDENT_RUNBOOK.md`: detect → contain → assess → notify (CAQ + affected persons when serious harm risk) → record → review. Time targets: contain within 24h, register entry within 72h.
- **`docs/DATA_MAP.md`:** table of every personal-data kind → where stored/processed: Postgres (Prisma Postgres — region: Vercel US-East per current hosting; note: prefer Canadian region if/when the provider offers it), Vercel Blob (attachments/receipts — region), Resend (email — US), Meta WhatsApp (messages — US), Anthropic (Copilot — US), Stripe (payments — business's own account), Google (OAuth/Calendar — US). Each row: data kind, storage, processor, region, retention. Gaps called out honestly (no Canadian-region option for Resend/Anthropic today).

## A12. Operations

- **Environments:** three separate Prisma Postgres projects/databases: `kivo-dev` (local dev + tests), `kivo-staging` (preview/QA), `kivo-prod` (production). Connection strings in separate env vars (`DATABASE_URL` per environment — never shared). Implementation: create the staging project in the Vercel dashboard (user action — the plan lists the exact clicks), wire `DATABASE_URL` for the staging deployment, verify staging boots against staging DB.
- **Pooling:** keep `connection_limit=1` + retry middleware (already in `src/lib/prisma.ts` / `db-retry.ts`). RLS `set_config` (A3) is transaction-local and pool-safe. No PgBouncer (no $0 option on Prisma Postgres free) — documented as a known constraint; if connection exhaustion recurs, the fix is the paid plan, not a code change.
- **Backups + restore drill:** Prisma Postgres free = daily backups (verify in dashboard — if PITR is available on the plan, use it). Drill: restore the latest backup into the STAGING database, time it, verify the app boots and a spot-check query returns expected rows. Record elapsed time + steps in `docs/BACKUP_RESTORE.md`. Cadence: drill once after setup, then quarterly (calendar reminder, not a cron).
- **Seed script** (`scripts/seed-staging.ts`): Business A (Ontario) + Business B (Quebec), each with owner + admin + dispatcher + technician (memberships), 3 consumer accounts, customers with addresses in ON/QC/BC/NS, jobs (past/today/future/no-date), quotes in every status, invoices (partial-paid, full-paid, voided), expenses with receipts (receipt files = tiny placeholder PNGs, not real receipts). Seed is idempotent (upsert by a stable `seedKey`) and NEVER runs against production (guard: refuses when `DATABASE_URL` matches the production project id — the guard reads an explicit `SEED_ALLOW_PROD=false` env, default false).

## Definition of done (Part A)

- [ ] All 12 migrations applied on local + staging, each with rollback notes.
- [ ] `npm test` green (incl. new tests: tax immutability, numbering concurrency, audit append-only, idempotency replay, RLS cross-tenant rejection, QST base).
- [ ] `npx tsc --noEmit` green, CI green.
- [ ] EXPLAIN ANALYZE before/after in `docs/PERF.md`.
- [ ] `docs/TAX_NOTES.md`, `docs/DATA_RETENTION.md`, `docs/INCIDENT_RUNBOOK.md`, `docs/DATA_MAP.md`, `docs/BACKUP_RESTORE.md` written.
- [ ] `docs/AGENT_LOG.md` updated with evidence per migration.
- [ ] No production touch (local + staging only).
