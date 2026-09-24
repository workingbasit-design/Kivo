# Kivo — Release Notes (Release-Readiness Pass, 2026-09-22)

This pass brought the app to release condition: every known defect from prior
review was fixed and verified, followed by a full adversarial QA matrix
(79 PASS / 0 FAIL, logged in `TEST_REPORT.md` with 100+ evidence screenshots
in `~/workspace/kivo-shots/release/`).

## What was fixed

**Share tokens (was: unguessable but irrevocable cuid URLs).** New `ShareToken`
model; public portals are now token-based (`/q/[token]`, `/i/[token]`).
Invoice/quote detail pages have a share-link manager: copy, regenerate
(invalidates the old token), revoke, optional expiry. Expired/revoked/malformed
tokens render a friendly "link invalid or expired" page — no data leakage.
Old cuid-style URLs no longer resolve. Public token resolution is rate-limited
and tenant-isolated (verified by fuzz testing).

**Invoice line items (was: structured text in `notes`).** New
`InvoiceLineItem` model (description, qty, unit price, position). Existing
invoices were migrated best-effort with original notes preserved. Create/edit/
detail/public views all use line items; subtotal = sum of lines. GST math
verified: IN 18% with CGST/SGST split display; CA provinces including Quebec
($1,000 → GST $50 + QST $99.75 = $1,149.75, rate stored at 3-decimal precision
14.975). Currency is tenant-aware everywhere (₹ for IN, $ for CA).

**Business fields (was: setup no-op).** `Business.whatsappNumber` and
`Business.workingHours` (JSON string) added, persisted via the settings form,
working hours displayed on the public booking page, WhatsApp number preferred
for wa.me links.

**AI booking idempotency (was: double-confirm could duplicate jobs).**
Confirm-once semantics via client idempotency key with deterministic-hash
fallback; replays return the original job (`duplicate:true`); in-flight dedupe;
`Job.idempotencyKey` unique column as the DB backstop (survives restarts).
Booking-submit idempotency added the same way. Verified: 5 concurrent confirms
→ exactly 1 job.

**Schedule status transitions (was: UI offered invalid backward moves).**
Canonical transition rules in `src/lib/job-status.ts`, enforced server-side and
mirrored in the UI (dropdown only offers valid next states; server rejections
surface a clear banner instead of failing silently).

**Session cleanup (was: expired sessions never deleted).** Expired sessions are
deleted on access, purged on new login, plus an amortized probabilistic sweep
(~2% of authenticated requests) so the table can't grow unboundedly.

**CSRF/origin (was: never audited).** Empirically verified: Next.js 16
framework rejects forged-Origin server-action calls ("Invalid Server Actions
request"); API routes get no framework protection, so `src/lib/csrf.ts`
`checkSameOrigin()` is now enforced on `POST /api/copilot`, `/api/export`, and
`/api/places/search`. Browsers always send Origin cross-origin; header-less
(non-browser) clients are still allowed.

**Recurring auto-generation (was: manual button only).** Lazy generation on
dashboard load: due occurrences are created inside a single write transaction
(check-then-create), guarded by a per-business in-process mutex; DB backstop
`@@unique([recurringJobId, date])`. Verified: 8 parallel dashboard loads →
exactly one job per due date, `nextRun` advanced. Catch-up is one occurrence
per load by design (manual Generate button still available).

**Marketing honesty.** Audited every send-adjacent UI: drafts say "Save draft",
wa.me buttons say "Send via WhatsApp" (they genuinely open WhatsApp), reminders
are labeled drafts. Nothing implies the app delivered a message.

**Dead-ends sweep.** Every page/dialog/form across all modules was clicked
through: fixed a booking-settings 500 (new `src/lib/slug.ts`), hydration
mismatches, price-book duplicate-name guard, silent action-error swallowing in
reviews/price book, misleading empty states, and dead links. Copilot gained an
`ask_customers` intent (Hinglish "mere kitne customers hain?" now answers from
real tenant data); gibberish/out-of-scope questions get help text, never
invented answers.

## Verification summary

- `npx tsc --noEmit`: clean, 0 errors.
- `npm run build`: passes (all routes).
- `TEST_REPORT.md`: 79 PASS, 0 FAIL, 2 UNTESTED (both covered by other passing
  tests). Covers positive flows (fresh IN + CA businesses, every module),
  negative cases (invalid input, double-submits, tampered cross-tenant IDs,
  expired/revoked/malformed tokens), boundary cases (all CA provinces, year-
  boundary weeks, GST rounding), security (tenant-isolation fuzz, unauth
  access, 429 rate-limit confirmation, forged-Origin probes), full lifecycle
  workflows, and desktop + mobile browser matrix.

## How to deploy

**Do not deploy on SQLite.** Migrate to Postgres before production:

1. Provision Postgres (e.g. Neon, Supabase, RDS).
2. Set `DATABASE_URL="postgresql://..."`.
3. Change `prisma/schema.prisma` datasource provider to `postgresql` and run
   `npx prisma migrate deploy` (generate a migration from the current schema
   with `npx prisma migrate dev` in a staging environment first).
4. Notes: the `@@unique([recurringJobId, date])` and `idempotencyKey @unique`
   constraints behave the same in Postgres (multiple NULLs allowed).

**Environment variables (production):**
- `DATABASE_URL` — Postgres connection string (required).
- `ANTHROPIC_API_KEY` — optional; enables Claude-powered copilot replies.
  Without it the copilot uses the built-in rule-based engine (fully functional).
- `NEXTAUTH_SECRET` / session secret — if the session cookie signing is
  externalized, set a 32+ byte secret (current dev default is not for prod).
- `APP_URL` / `NEXT_PUBLIC_APP_URL` — canonical public URL, used for share
  links and the CSRF origin allow-list.

**Required secrets:** DB credentials, session secret, `ANTHROPIC_API_KEY`
(optional). No payment keys exist by design — Kivo never processes money;
UPI/payment details are display text only.

**Checklist:** `npx tsc --noEmit` clean → `npm run build` green →
`npx prisma migrate deploy` → smoke-test register/login/booking on the
deployed URL → confirm share-token links work publicly.

## Accepted risks (with justification)

- **In-memory rate-limit/idempotency stores are single-instance.** Fine for a
  single Node process (documented assumption, same as before); multi-instance
  deployments need Redis/shared storage. Not a launch blocker for typical
  small-business VPS deploys.
- **`/api/places/search` is intentionally public** (needed by the unauthenticated
  booking page address autocomplete) — mitigated with origin check + 30
  req/min/IP limit + 5-minute cache + minimal field projection.
- **No professional penetration test.** Security posture is framework-enforced
  (server actions), origin-checked (API routes), tenant-scoped (every query),
  and fuzz-tested — but a formal pentest is recommended before handling
  high-value customer data.
- **Quebec QST stored at 3-decimal precision (9.975%).** Correct for math;
  any downstream export/report assuming 2-decimal rates should be checked.
- **Nominatim geocoding depends on OSMF fair use** (1 req/sec throttle built
  in). If OSMF blocks the egress IP, routing degrades gracefully to
  "could not locate" cards — never a crash.
- **No automated cron for recurring catch-up** beyond dashboard-load lazy
  generation; a plan months overdue catches up one occurrence per dashboard
  visit (manual Generate button available).

---

## Sprint additions (2026-09-23)

**AI Insights dashboard (`/insights`).** Forward-looking analytics computed
strictly from the business's own records — no benchmarks, no fake data. Revenue
momentum (last complete month vs previous), margins by service (job revenue
minus recorded expenses, best/worst highlighted), customer lifetime value +
repeat-customer rate, seasonal demand (avg jobs/month across all history), smart
scheduling suggestions (busiest day, highest-value day, quiet windows), quote
win-rate with stale-quote follow-up list (SENT 7+ days), and team utilization.
Every figure is labeled "computed from your own data" with the backing record
counts; empty states explain what to do. EN/fr-CA, loading skeleton, sidebar
nav item. Pure computation (`src/lib/insights-compute.ts`) covered by 9 unit
tests; DB entry point (`getInsights`) is tenant-scoped via `requireAuth`.

**Command palette (⌘K / Ctrl+K).** Bilingual, keyboard-operable (arrows/enter/
esc), covering all nav destinations plus quick actions (new job/customer/quote/
invoice). Lazy-loaded client-side (`ssr: false`) via a new `LazyOverlays`
wrapper so it costs nothing on first paint; trigger buttons in the desktop
sidebar and mobile top bar.

**Perf.** `GlobalCopilotWidget` and the command palette moved behind the lazy
overlay wrapper — neither ships in the first-paint bundle anymore. Dashboard
and insights data layers use batched queries (`Promise.all`, `groupBy`); no
N+1 patterns found on dashboard/reports/insights paths.

**Import hardening.** CSV customer/service imports now dedupe against existing
records (customers: normalized name+phone; services: name) and within the file
itself — re-importing the same file reports "skipped" counts instead of
creating duplicates. The import UI already surfaced skipped counts.

**Docs.** New `docs/USER_SETUP_CHECKLIST.md`: consolidated setup checklist with
exact env vars, provider accounts, Google OAuth redirect URIs
(`/api/auth/google/callback`, `/api/google/callback`), Stripe Connect redirect
(`/api/stripe/callback`), Stripe webhook (`/api/stripe/webhook`,
`checkout.session.completed` + `checkout.session.expired`) and WhatsApp webhook
URIs, cron routes and `CRON_SECRET` auth, per-business in-app setup, and the
graceful-degradation behavior of every integration.

Verification on the final tree: `npx tsc --noEmit` clean, `npm test` 442/442,
`npm run build` green.

## Deploy note (2026-09-24)
Production (Vercel) was still serving the pre-release build because the release push did not trigger a Vercel build. This commit re-triggers the production deployment of the release.

