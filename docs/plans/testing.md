# Prompt 4 — Test everything, for every type of user: PLAN

**Status: PLAN — waiting for user OK before any implementation.**
**Scope:** test infrastructure + tests only. No application behavior changes, no production contact. All DB-backed and browser tests run against an isolated test database and a local `next start` build. Never production.
**Sources read:** `AGENTS.md` (repo), `docs/AUDIT.md` (2026-10-13), `docs/SECURITY_REPORT.md`, `.github/workflows/ci.yml`, `package.json`, `scripts/seed-staging.ts`, `scripts/seed-perf.ts`.

## 0. What already exists (do not rebuild)

| Asset | Status | Evidence |
|---|---|---|
| Unit/integration runner | ✅ `node --test` + `register-loader.mjs`, 125 files, **1205 tests green** | `src/lib/__tests__/`, `npm test` |
| CI `validate` job | ✅ push/PR: lint, tsc, i18n parity, tests, raw-SQL check, build | `.github/workflows/ci.yml` |
| i18n parity check | ✅ fails CI on missing/untranslated keys | `scripts/check-i18n-parity.mjs` |
| Two-business seed | ✅ Business A (Ontario) + B (Quebec), owner/admin/dispatcher/technician each, 3 consumers, idempotent, refuses prod | `scripts/seed-staging.ts` |
| Perf seed | ✅ 10k jobs / 5k customers | `scripts/seed-perf.ts` |
| RLS policy tests | ✅ 8 staging-gate tests (skip without `TEST_DATABASE_URL`) | `src/lib/__tests__/rls.test.mts` |
| Tenant-isolation tests | ✅ fail-closed guard + `TENANT_MODELS` sync test | `tenant-isolation.test.mts`, `cross-tenant.test.mts` |
| Copilot prompt-injection tests | ✅ | `copilot-injection.test.mts` |
| Auth rate-limit tests | ✅ | `auth-rate-limit.test.mts` |
| Module stub pattern | ✅ `*-stub-loader.mjs` stubs `@/lib/prisma` etc. | `src/lib/__tests__/` |
| Money/tax unit tests | ✅ partial (calcTax, money) | `billing.test.mts`, `money*.test.mts` |

**Gaps:** no browser E2E at all, no axe, no auth-matrix generator, no `tests/README.md` traceability, no `docs/BUGS.md`, no `docs/MANUAL_QA.md`, no `docs/TEST_REPORT.md`, no CI DB service, no dependency audit gate, no `.only` check.

## 1. Tools (all $0; new deps need user OK per repo rule)

| Need | Choice | Why |
|---|---|---|
| Unit/integration | Keep `node --test` (existing) | 1205 tests, zero migration, AGENTS.md documents the stub pattern. Prompt allows "the runner the project already uses". |
| Browser E2E | `@playwright/test` (devDep, NEW) + free browser downloads | Device projects: iPhone/WebKit 390×844, Pixel/Chromium, Desktop Chrome. `playwright-core` already used in `~/workspace/mobile-qa`. |
| Accessibility | `@axe-core/playwright` (devDep, NEW) | Zero serious/critical gate on every page × en/fr. |
| Test database | GitHub Actions `postgres` service (CI); `TEST_DATABASE_URL` skip-pattern locally (existing) | No Docker on this VM, no local Postgres binaries — DB tests run in CI, skip locally. Same pattern `rls.test.mts` already uses. |
| Email capture (E2E) | Playwright `page.route()` intercept of Resend API calls | App sends via Resend HTTP API (not SMTP), so Mailpit can't see it without app changes. Interception needs zero app changes. |
| SMS | Assert `sms:`/`tel:`/`wa.me` link formats (app never sends SMS server-side by design) | Matches $0 architecture. |
| Stripe | Test mode; exercise only flows the app actually has (Connect onboarding test mode, `/api/pay/*` test cards, webhook signature reject) | AUDIT: "Connect-style records; no in-app card processing" — verify each planned test against the real flow first (VERIFY items). |
| Fixed clock | Unit: injectable clock param. E2E: seed relative dates (yesterday/today/tomorrow) at seed time | No app clock-mocking required. |
| Perf | Playwright timing assertions + seeded 10k dataset; Lighthouse as separate non-blocking workflow | Lighthouse on shared CI runners is flaky — record, don't gate. |

**New dependencies to approve:** `@playwright/test`, `@axe-core/playwright` (both dev-only, free, no runtime footprint).

## 2. Folder layout

```
tests/
  README.md                 # traceability table: feature → test IDs → status
  fixtures/                 # shared persona creds (seeded accounts), XSS payload list,
                            # tamper vectors, fr-CA scan allowlist (proper nouns)
  unit/                     # (existing files stay in src/lib/__tests__/)
  db/                       # TEST_DATABASE_URL-gated: isolation, RLS, numbering races
  auth-matrix/              # generator + persona tests
  e2e/
    fixtures.ts             # base fixture: seeded DB, logged-in personas
    anonymous.spec.ts       # §5 anonymous journeys
    consumer.spec.ts        # §5 customer journeys
    owner.spec.ts           # §5 business owner journeys
    team.spec.ts            # §5 team-member journeys
    bilingual.spec.ts       # §7 fr-CA journeys + no-English-visible scan
    a11y.spec.ts            # §8 axe sweeps
    attacker.spec.ts        # §6 browser-side checks (IDOR URL edits, uploads)
  scripts/
    gen-auth-matrix.mjs     # scans routes + actions → matrix template (CI fails on drift)
    seed-e2e.mjs            # wraps seed-staging.ts + relative-date fixups
docs/
  BUGS.md                   # §12: ID, repro, expected/actual, severity, status
  MANUAL_QA.md              # §11: 45–60 min real-phone checklist
  TEST_REPORT.md            # output: totals, CI link, traceability, bugs, untestable items
```

Test ID convention: `P4-U-###` unit, `P4-D-###` database, `P4-A-###` auth matrix, `P4-E-###` e2e, `P4-X-###` attacker, `P4-B-###` bilingual, `P4-AX-###` accessibility, `P4-P-###` performance.

## 3. Test data

- Base = `scripts/seed-staging.ts` (Business A Ontario / Business B Quebec, 4 roles each, 3 consumers, jobs past/today/future/no-date, quotes every status, invoices incl. partial-paid/voided, expenses with receipt PNGs). Idempotent, refuses production.
- E2E wrapper adds: relative-date fixups (a job due "yesterday" for the Late badge, an invoice past-due), known totals for Money/Dashboard reconciliation assertions, a deterministic `createdAt` order for sort tests.
- Perf = `scripts/seed-perf.ts` (10k jobs, 5k customers) into the CI test DB only.
- All QA identities use the `QATEST`/`E2ETEST` prefix convention (never touch prod data; CI DB is created fresh per run).

## 4. CI design (`.github/workflows/ci.yml` — extend `validate`, add jobs)

```
validate (existing, extended):
  npm ci → lint → tsc → i18n parity → npm test → raw-SQL check → build
  + npm audit --audit-level=high        # NEW: fails on high/critical
  + .only/.skip check                  # NEW: grep fails on committed .only/.describe.only/test.only/.skip
db-tests (NEW, needs TEST_DATABASE_URL):
  services: postgres:18 → prisma migrate deploy → npm run test:db
e2e (NEW, 3 shards × device project):
  services: postgres:18 → seed → next build → next start → playwright test
  artifacts: HTML report, traces, screenshots (always upload)
a11y: part of e2e (axe assertions inside specs, zero serious/critical)
perf (NEW, separate workflow, non-blocking):
  manual_dispatch + weekly schedule: Lighthouse mobile (Home, Directory, Pro profile,
  Dashboard, Jobs) → record LCP/CLS; flag LCP > 2.5s / CLS > 0.1 in TEST_REPORT
```

Merge to `main` blocked unless `validate`, `db-tests`, `e2e` are green. Playwright sharded 3 ways to keep PR time sane. E2E runs against `next start` (production build) — never the dev server, never production.

## 5. Test list

### 5.1 Unit — money & tax (extends `billing.test.mts`)

| ID | Test | State |
|---|---|---|
| P4-U-001 | GST 5% / HST 13–15% / QST 9.975% on price **excluding** GST; PST provinces | ✅ exists (extend) |
| P4-U-002 | Nova Scotia 15% before 2025-04-01, 14% from that date | 🔨 build |
| P4-U-003 | Small supplier (no tax), mixed taxable+exempt lines, documented rounding rule | 🔨 build |
| P4-U-004 | Deposits, partial payments, overpayment rejected, refunds, credit notes | 🔨 build (partial exists) |
| P4-U-005 | `dollarsToCents`/`centsToDollars` round-trip, no float drift | ✅ exists (extend) |

### 5.2 Unit — dates (extends `booking-timezone.test.mts`, `ca-holidays.test.mts`)

| ID | Test | State |
|---|---|---|
| P4-U-010 | Late logic vs business timezone (not server UTC) — Toronto evening edge | 🔨 build |
| P4-U-011 | "today"/"this week" in America/Toronto, America/Vancouver, America/Regina (no DST), America/St_Johns (+0:30) | 🔨 build |
| P4-U-012 | Evening local time already next-day UTC | 🔨 build |
| P4-U-013 | DST end Sun 2026-11-01, DST start Sun 2027-03-14 | 🔨 build |
| P4-U-014 | Holidays incl. Thanksgiving Mon 2026-10-12 | ✅ exists (extend) |

### 5.3 Unit — status rules, numbering, exports, validation

| ID | Test | State |
|---|---|---|
| P4-U-020 | Every allowed/blocked transition: job, quote, invoice state machines | 🔨 build |
| P4-U-021 | Concurrent creation → unique sequential numbers (DocumentCounter, DB-gated) | 🔨 build |
| P4-U-022 | CSV sanitization (formula neutralization `=`, `+`, `-`, `@`) | ✅ exists (extend) |
| P4-U-023 | Every zod input schema: valid + invalid examples | 🔨 build (partial exists) |

### 5.4 Database & isolation (`tests/db/`, TEST_DATABASE_URL-gated)

| ID | Test | State |
|---|---|---|
| P4-D-001 | As Business B user: cannot SELECT/INSERT/UPDATE/DELETE Business A rows — every `businessId` table | 🔨 build (extends cross-tenant/rls tests) |
| P4-D-002 | Technician role sees only role-matrix-allowed rows | 🔨 build |
| P4-D-003 | Anonymous: only public directory data readable | 🔨 build |
| P4-D-004 | Consumer: only own requests/messages/saved pros | 🔨 build |
| P4-D-005 | Storage: Business B cannot read Business A blobs even with guessed path (signed/checked server route) | 🔨 build |
| P4-D-006 | RLS policies: re-run `rls.test.mts` gate — 8/8 | ✅ exists |

### 5.5 Authorization matrix (`tests/auth-matrix/`)

- `scripts/gen-auth-matrix.mjs` scans `src/app/api/**/route.ts` (methods + `getSession`/`requireAuth` presence) and `src/app/actions/*.ts` (exported server actions) → emits `matrix.json` template. **CI fails if any route/action is missing from the checked-in expected table** (so new routes can't skip review).
- Persona tests call each entry as: anonymous, consumer, owner A, admin A, dispatcher A, technician A, owner B using A's IDs. HTTP for routes (E2E), function-level with session stubs for server actions (existing `auth-stub` pattern).

| ID | Test | State |
|---|---|---|
| P4-A-001 | Matrix generator + drift check | 🔨 build |
| P4-A-002 | All 52 API routes × 7 personas vs expected allow/deny | 🔨 build |
| P4-A-003 | All server actions × 7 personas vs expected allow/deny | 🔨 build |

### 5.6 E2E by persona (`tests/e2e/`, 3 device projects)

**Anonymous** — home/nav/footer/pricing; language switch en↔fr remembered; directory search/filters/empty state/pro cards/profiles; quote request validation + past-date reject + success → lead email intercepted; legal pages, 404, titles/meta. IDs P4-E-001…012.

**Consumer** — register/verify/login/logout; wrong password → generic message; forgot-password (intercepted email, single-use + expired link rejected); save/unsave pro; quote request → status change on accept/decline; messaging thread; portal flows **VERIFY-first** (`/portal`, `/q`, `/sign`, `/api/pay` — test only what exists); profile edit, data export, account delete → business keeps invoice record. IDs P4-E-020…040.

**Business owner** — onboarding checklist incl. "Do later"/"Show setup checklist"; settings (logo upload accept/reject matrix, tax numbers, team invite intercepted, Stripe test-mode connect, Interac email, calendar mocked); customers CRUD + archive-with-invoices + delete-unlinked + import good/bad-rows/formula-cells + CSV/Excel export; jobs CRUD + inline new customer + validation + TBD + start/complete/invoice + Late badge (seeded yesterday) + delete rules + costing margin bar green/amber/red; schedule week nav + today highlight + empty-day tap + status colors + counts = Jobs list; quotes line items + provincial tax + deposit rules + draft/send (intercepted, customer language) + duplicate/accept/decline/convert/expire; invoices blank/from-quote/from-job + batch (2 created, jobs delisted, empty state) + payments (over-balance/zero rejected, partial→Partially paid, full→Paid) + void-with-reason + delete-only-drafts + Overdue; expenses receipt photo + filters + totals + viewer + remove + delete; leads accept→customer+draft job / decline confirm / message; equipment CRUD; copilot ("Who owes me money?" = Business A only = Invoices list; action card needs Yes; No cancels; mic-denied handled); global search/notifications scoped; help search + ticket; Money/Dashboard totals = seeded known totals. IDs P4-E-050…120. Each journey asserts happy path + validation errors + the other side's view.

**Team members** — each role sees/does exactly the matrix; deep-link guard (can't reach invoices/settings by URL as technician); removed member signed out immediately. IDs P4-E-130…138.

### 5.7 Attacker suite

| ID | Test | Layer | State |
|---|---|---|---|
| P4-X-001 | IDOR: every `:id` route with B's IDs as A (covered by matrix §5.5) + browser URL-edit spot checks | HTTP+browser | 🔨 build |
| P4-X-002 | Tampered bodies: price, totals, business_id, role, status | HTTP | 🔨 build |
| P4-X-003 | XSS payloads in every field another human sees → pages, intercepted emails, CSV exports, copilot answers | unit+browser | 🔨 build (partial: copilot-injection ✅) |
| P4-X-004 | Brute force login + password reset → rate limits engage | HTTP | ✅ exists (extend to reset flow) |
| P4-X-005 | Open redirect via `?next=`/redirect params | unit | ✅ exists (extend) |
| P4-X-006 | Upload attacks: SVG/exe renamed/oversize (Prompt 3 matrix) | browser+unit | ✅ exists (extend to E2E) |
| P4-X-007 | Unsigned/replayed Stripe webhook rejected | unit (existing sig check) | ⚠️ VERIFY flow, then build |
| P4-X-008 | Cross-origin state-changing request rejected (CORS/CSRF) | HTTP | 🔨 build |
| P4-X-009 | Framing on another origin blocked (`frame-ancestors`/SAMEORIGIN) | HTTP header | 🔨 build |
| P4-X-010 | Directory claim of another business without verification fails | browser+unit | ✅ exists (extend) |
| P4-X-011 | Copilot prompt injection via lead description changes nothing | unit | ✅ exists |

### 5.8 Bilingual (`tests/e2e/bilingual.spec.ts`)

Core journeys (signup, customer, job, quote, invoice, payment, quote request) fully in fr-CA. **Fail if any English visible in French mode**: rendered-text scan against fr dictionary + allowlist (proper nouns, "OK", brand terms). Currency/dates/times in fr-CA formats. Intercepted emails in customer's language. IDs P4-B-001…012. (Complements the existing key-parity CI check, which can't catch hardcoded English.)

### 5.9 Accessibility (`tests/e2e/a11y.spec.ts`)

axe on every page × en/fr: **zero serious/critical**. Keyboard-only scripts: login, create job, create invoice, record payment. Every icon-button has an accessible name. IDs P4-AX-001…010.

### 5.10 Performance & resilience

| ID | Test | State |
|---|---|---|
| P4-P-001 | 10k jobs / 5k customers: lists paginate, search fast, no full-table loads (assert `LIMIT`/pagination + timing budget) | 🔨 build (seed exists) |
| P4-P-002 | Slow-3G + offline: clear error, nothing saved twice, double-tap Save = 1 record (idempotency keys) | 🔨 build |
| P4-P-003 | Lighthouse mobile on Home/Directory/Pro profile/Dashboard/Jobs — **record only**, non-blocking workflow | 🔨 build |

## 6. `tests/README.md` traceability

Table: feature → test IDs → status (pass/fail/skip — skips must be 0 in CI) → notes. Generated partly from test file headers; hand-maintained mapping for E2E journeys.

## 7. `docs/BUGS.md` (format)

`ID | area | severity P0–P2 | status | repro steps | expected | actual | regression test`. **P0/P1 fixed immediately with regression tests. P2: logged, fix only with user OK** (per prompt).

## 8. `docs/MANUAL_QA.md` (45–60 min, real iPhone + Android)

Camera receipt upload; real email receipt; portal link from SMS; test-card payment on phone; one-handed use; outdoor readability; French mode; slow data. Each step: do → expect → ☐.

## 9. Output: `docs/TEST_REPORT.md`

Totals (passed/failed/skipped=0), CI run link, traceability table, bugs found+fixed, and everything not automatable with the reason. **Then stop and wait for user review** (per prompt).

## 10. Cannot be tested automatically (honest list)

- Real-device camera/GPS/sensors → MANUAL_QA.
- Real email/SMS delivery (only intercepted content) → MANUAL_QA.
- Visual "feel"/design quality → human eye.
- Stripe Connect real onboarding (identity/bank) → user hands only.
- Google OAuth real consent → mocked in automation.
- Production-data migrations/backfills → never run from tests.

## 11. Decisions needed (your OK)

1. **Approve the two dev dependencies** (`@playwright/test`, `@axe-core/playwright`)? Nothing installs until you say yes.
2. **E2E on every push+PR** (prompt's CI section) — heavier CI minutes but exactly what the prompt demands. OK?
3. **Lighthouse non-blocking** (record-only weekly) — OK, or do you want it gating?
4. **P2 bugs**: log-only until you approve each fix — confirmed?
5. **Any journeys to cut?** The owner section (§5.6) is the biggest; flag anything to defer.
6. **Build order**: setup → unit → db → matrix → e2e → attacker → bilingual → a11y → perf → CI → manual script → TEST_REPORT. OK?
