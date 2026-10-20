# Release Plan — Oct 21, 2026 (EveryJob Production Release)

Owner directive (2026-10-19 21:53 EDT): app working on the new Oracle database,
every functionality fully tested, every UI issue resolved, release-ready.
Quality bar: **not even a minor issue.** Release date: **Wed Oct 21, 2026**.

Roles for this release: Architect (infrastructure), Developer (code/merge),
Tester (full functional + UI verification), BA (scope, acceptance, report).

## Phase 0 — Infrastructure (Architect) — Oct 19 night
- [ ] Oracle VM `kivo-db` running: Ampere A1, 2 OCPU / 12 GB, Ubuntu 24.04, Always Free
- [ ] PostgreSQL installed + hardened (firewall: SSH + 5432 only; strong app password)
- [ ] **Production-grade PostgreSQL config (senior bar):** tuned for the VM (shared_buffers, work_mem, max_connections sane for 12GB RAM — not dev defaults); connection limits matched to app; WAL + checkpoint settings for durability
- [ ] **Data durability better than the old setup:** nightly pg_dump + weekly full backup on block storage; restore tested once end-to-end; backups kept 14 days
- [ ] **No silent data loss:** multi-write operations wrapped in transactions; FK constraints enforced; every write path returns explicit success/failure to the UI
- [ ] Fresh database `everyjob` + app user created (EMPTY — fresh start per owner)
- [ ] Automated nightly backup (pg_dump cron) + heartbeat against idle reclaim
- [ ] Oracle budget alert set (free) — usage approaching limits notifies owner

## Phase 1 — Code release (Developer) — Oct 20
- [ ] Merge `fix-now-kit` → `main` (resolves feedback-log items 1–14 + 15, 16, 18, 19)
  - Includes the two main-only morning-QA fixes already on the branch tip (FR invoice due hint, quote double-conversion guard)
- [ ] CI fully green on main: lint, tsc, unit tests, colour-count, tokens, i18n parity, readability (light+dark)
- [ ] Point Vercel `DATABASE_URL` (prod) at Oracle PostgreSQL
- [ ] Prisma migrations applied to the fresh DB (`prisma migrate deploy` / db push per repo flow)
- [ ] Production deploy from main; /api/health green against Oracle DB
- [ ] **DB completeness verification (owner: "nothing gets missed"):**
  - Every Prisma migration applied in order, zero failures (`prisma migrate status` clean)
  - Every model in schema.prisma has its table in the DB; every field has its column (no drift — diff schema vs information_schema)
  - All indexes, foreign keys, and unique constraints present
  - App CRUD smoke test against every model via the API (create+read+delete on each core entity)

## Phase 1.5 — Performance (Architect + Developer) — Oct 20
Owner bar: app fast and efficient even with heavy DB usage.
- [ ] **PgBouncer on the VM** (transaction pooling): Vercel serverless instances connect through the pooler, never raw Postgres — bursts can't exhaust DB connections (the exact failure that killed the Prisma setup). Migrations use the direct URL; app traffic uses the pooled URL.
- [ ] Vercel function region pinned closest to the Toronto DB (iad1) — every query pays minimal network distance.
- [ ] Index audit: every tenant query leads with `businessId` + its filter columns; add missing indexes via migration.
- [ ] No N+1: dashboard + list routes reviewed; aggregates parallelized (Promise.all); no sequential awaits in hot paths.
- [ ] Retry middleware tuned for a LAN database (short backoff — keep the safety, cut the wait).
- [ ] Response budget verified in test pass: core API routes p95 < 300 ms; tap-to-feedback instant via optimistic UI/loading states.

## Phase 2 — Functional testing (Tester) — Oct 20–21
Fresh account, end-to-end, per-feature results with evidence (owner's rule):
- [ ] Auth: register (business), login, logout, Google sign-in, 2FA setup + challenge, password reset, generic login error
- [ ] Onboarding: full flow + "Do later" path
- [ ] Dashboard: briefing, Key numbers, sections customize (toggle + reorder persist — item 15), Collected week/month toggle
- [ ] Jobs: create (incl. inline new customer), edit, status flow, Late rule (not-started+past = Late; in-progress never Late), complete → ready to invoice
- [ ] Schedule: week strip first, late banner → Jobs filtered to Late
- [ ] Quotes: create, tax dropdown (single control, real rates), send, accept → convert to job (no double-convert)
- [ ] Invoices: create from job, amounts visible (item 16), record payment, void with reason, delete DRAFT only
- [ ] Money page: totals visible in dark mode, all sections readable
- [ ] Customers: CRUD, soft-delete, import/export CSV
- [ ] Projects: create form labels/fields correct in dark mode (item 18), phases
- [ ] Expenses, Equipment, Inventory, Marketing pages: load + core actions
- [ ] Settings: business profile, appearance System/Light/Dark, security (2FA), team
- [ ] Directory: search, claim flow reachable
- [ ] Copilot: ask a question, example prompts
- [ ] FR locale: spot-check key screens in fr-CA
- [ ] Responsiveness: tap-to-response feels instant on 5G (item 17) — no dead buttons

## Phase 3 — UI verification (Tester) — Oct 21
- [ ] Every route at 390px, light AND dark: contrast, theme consistency (item 19), no white fields in dark, no ghost text
- [ ] Screenshots archived; compared against mockups
- [ ] Feedback log items 15–19 verified closed with evidence

## Phase 4 — Release gate (BA) — Oct 21
- [ ] Release report: per-feature PASS/FAIL with evidence; any FAIL blocks release
- [ ] Known-issue list empty (zero-issue bar) or owner-signed exceptions only
- [ ] Owner eye-test on production URL

## Hard constraints (standing)
- $0 spend — Always Free only; never upgrade Oracle account
- Canada-only, CAD, en-CA + fr-CA
- No real payments/email/SMS in QA; Stripe stays test mode
- QA data labelled QATEST
