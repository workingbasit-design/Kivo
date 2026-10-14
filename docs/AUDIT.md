# EveryJob Truth Audit

**Date:** 2026-10-13
**Repo:** ~/workspace/kivo, HEAD 5898475
**Mode:** Read-only. No application code, configuration, dependencies, or database were changed.

## Summary

EveryJob is a Next.js 16.3.6 + React 19.2.8 field-service SaaS for Canadian home-service shops, backed by Prisma Postgres on Vercel. The codebase is large (111 pages, 51 API routes, 50 server-action files, 78 database models) with 1029 passing tests and CI green. Money is stored as dual-write Float dollars + BigInt cents (migration in progress 2026-10-13). Tenant isolation is enforced at the application layer via a fail-closed guard covering 55 models; Row Level Security is not used. The app is publicly reachable with solid security headers (HSTS, nosniff, SAMEORIGIN) but no Content-Security-Policy. Key gaps vs a Jobber-class app: no PDF generation, no automated messaging (deliberate $0 constraint), no soft-delete/archive, and no full CRUD audit log. The Next.js version needs a 16.3.6 → 16.3.8 security upgrade (7 advisories, 1 high). Ten screenshot issues were investigated: 4 are fixed in code (pending live verification — Vercel deploy appears stalled), 6 remain real.

---

## Step 1. Stack Report

### Framework and Versions

| Component | Version | Source |
|-----------|---------|--------|
| Next.js | 16.3.6 | package.json |
| React | 19.2.8 | package.json |
| React-DOM | 19.2.8 | package.json |
| TypeScript | 5.x (strict) | package.json, tsconfig |
| Prisma | 5.22.0 | package.json |
| Package manager | npm (package-lock.json) | repo root |
| Language | TypeScript + App Router | src/app |

### Providers and Services

| Concern | Implementation | Evidence |
|---------|---------------|----------|
| Database | Prisma Postgres (Vercel), `kivo-db` | prisma/schema.prisma |
| ORM | Prisma Client, `connection_limit=1`, retry middleware (pre-execution only) | src/lib/prisma.ts, src/lib/db-retry.ts |
| Auth | Custom sessions (`kivo_session` cookie) + Google OAuth | src/lib/auth.ts:34,77 |
| File storage | Vercel Blob ^2.8.0 | package.json, src/app/actions/attachments.ts |
| Email | Resend via direct fetch (no SDK) | src/lib/messaging/ |
| SMS | None server-side; `sms:` deep-links only (by design, $0) | src/lib/sms.ts |
| Payments | Stripe Connect-style records; no in-app card processing | src/app/actions/stripe.ts |
| AI (Copilot) | Anthropic Claude (optional), rule-based fallback | src/lib/copilot/anthropic.ts |
| i18n | Custom en/fr (not next-intl) | src/lib/i18n/ |
| Hosting | Vercel (auto-deploy from GitHub main) | vercel.json |
| Analytics | None found | grep package.json, src/lib |
| Error tracking | None found | grep package.json, src/lib |

### Tests and CI

- **Test files:** 100 (`src/lib/__tests__/*.test.mts`)
- **Test count:** 1029 pass, 0 fail (verified 2026-10-13)
- **CI:** Exists (`.github/workflows/ci.yml`), runs on push to main + PRs: `npm ci` → `lint` → `tsc --noEmit` → `npm test` → `npm run build` (Node 22)

### Security Advisory Comparison

**Next.js 16.3.6** (installed):
- CVE-2026-94545 (Critical 9.5, Sept 22 2026): ImageResponse/Satori SVG RCE — **fixed in 16.3.6**. App runs exact patched version; zero ImageResponse usage found. Not vulnerable.
- CVE-2026-75604 (Critical 9.0, Oct 12 2026): Path traversal — **fixed in 16.3.3**. Already included. Not vulnerable.
- **Sept 30 2026 release 16.3.8** fixes 7 advisories: 1 high (SSRF in Image Optimization, CVE-2026-94483), 5 medium (cache poisoning ×2, metadata disclosure, Draft Mode leak, nested cache leak), 1 low (dev MCP disclosure).
- **Upgrade needed: 16.3.6 → 16.3.8** (skip 16.3.7, bug-fix only). Do not upgrade yet per audit instructions.
- Applicability: `next.config.ts` sets no `remotePatterns` (SSRF likely not reachable); Vercel-hosted (self-hosted cache bugs don't apply); zero opengraph-image files, zero draftMode/use-cache usage. Exposure appears limited but upgrade warranted for defense in depth.

**React 19.2.8:** Advisory status could not be verified against official source. Flagged for follow-up.

---

## Step 2. Route and Permission Map

**Pages:** 111 page routes found (`find src/app -name "page.tsx"`).

| Path pattern | Purpose | Who can access | Auth check |
|--------------|---------|----------------|------------|
| `/(app)/*` (68 routes) | Business app (dashboard, jobs, schedule, money, etc.) | Business owner / team member | `(app)/layout.tsx:29` — requires session, redirects to /login if none |
| `/(auth)/login`, `/(auth)/register` | Business auth | Anonymous | `(auth)/layout.tsx` — renders form, no session required |
| `/portal/[token]` | Customer magic-link portal | Anyone with token | Token lookup, no session |
| `/q/[token]` | Quote approval | Anyone with token | Token lookup |
| `/sign/[token]` | E-signature | Anyone with token | Token lookup |
| `/track/[token]` | Live GPS tracking share | Anyone with token | Token lookup |
| `/book/[slug]` | Public online booking | Anonymous | None (public) |
| `/a/[token]` | Agent proposal approval | Anyone with token | Token + 24h expiry |
| `/directory`, `/` | Public marketing/directory | Anonymous | None |

**API routes:** 51 found (`find src/app/api -name "route.ts"`).

| Path pattern | Methods | Auth |
|--------------|---------|------|
| `/api/auth/*` | GET, POST | Session or OAuth flow |
| `/api/cron/*` | GET | `CRON_SECRET` header |
| `/api/stripe/webhook` | POST | Stripe signature verification (route.ts:37) |
| `/api/agent/v1/*` | GET, POST | API key |
| `/api/admin/migrate-cents` | GET | **NONE FOUND** — one-time backfill endpoint, should be removed (route.ts:4) |
| Others | Various | Session via `getSession()` or "verify" (inferred from filename) |

**Server actions:** 50 files in `src/app/actions/*.ts`, all `'use server'`. Auth via `requireAuth()` (auth.ts:77) + fail-closed tenant-guard middleware covering 55 models.

**Caveat:** Auth for ~20 API routes marked "verify" (inferred, not read line-by-line).

---

## Step 3. Data Model

**Models:** 78 tables, 0 enums (prisma/schema.prisma).

**Tenant isolation:** Row Level Security **not used anywhere**. Isolation is application-level via `src/lib/tenant-guard.ts` (fail-closed middleware). `TENANT_MODELS` set covers 55 models with `businessId`. 21 models lack `businessId` (identity roots like User, join tables, token-gated models).

**Money storage:** Dual-write as of 2026-10-13 migration:
- Legacy: `Float` dollars (e.g., `Job.price`)
- New: `BigInt` cents (e.g., `Job.priceCents`)
- 15 models have `*Cents` columns. Writes use `dollarsToCents()` (src/lib/money.ts). Reads still primarily via Float.
- Example: $149.00 → `price: 149.0`, `priceCents: 14900n`

**Date/time storage:**
- Dates: `DateTime` (UTC in DB), displayed in business timezone via `todayInTimezone`
- Times: `String` (e.g., `"10:00"`, `"09:00"`) — plain text, not normalized at storage

**Job status computation:**
- `isJobOverdue(status, date, now)` at src/lib/utils.ts:248 — calendar-day comparison
- Display: returns `'LATE'` for overdue jobs (utils.ts:283); `'Overdue'` for invoices
- **Bug:** Uses server-UTC `new Date()` — jobs dated "today" can flip LATE after ~8 PM Toronto time. Should use business timezone.
- Invoice status: `deriveStatus()` at src/app/actions/invoices.ts:338
- Invoice overdue: 30 days (src/lib/revenue.ts:21); workflow grace 14 days

**ON DELETE:** Most relations use `onDelete: Cascade` (e.g., Business → Job). Customer delete is **blocked** in code (not cascade) when jobs/invoices/quotes exist (src/app/actions/customers.ts:189-196).

---

## Step 4. Inventory Verification

**Note:** The prompt references "[PASTE THE FULL INVENTORY TEXT YOUR PREVIOUS AGENT GAVE YOU HERE]" but the inventory text was not included. Verification below is against the known app structure.

The claimed inventory (per prompt description) listed bottom tabs as Home, Jobs, Schedule, Copilot, More. The running app shows **Dashboard, Schedule, Jobs, Money, More** (verified in code: tab bar component). The inventory never mentions the Money page, which exists at `src/app/(app)/money/`.

| Claim | Verdict |
|-------|---------|
| Bottom tabs: Home, Jobs, Schedule, Copilot, More | **Exists but different** — actual tabs are Dashboard, Schedule, Jobs, Money, More |
| Money page exists | **Missing from inventory** — page exists at `/money` with unbilled/outstanding cards |
| Copilot as bottom tab | **Exists but different** — Copilot is a floating widget, not a tab |

**Screenshots:** Saved to `docs/audit-screens/` (when available). Live verification blocked: Vercel deploy appears stalled as of 2026-10-13 ~20:50 EDT (production bundle still pre-fix).

---

## Step 5. Screenshot Issues — Root Causes

**Note:** Commit `1188a77` (launch pack, Oct 13 15:03 EDT) landed after the screenshots but before this audit. Status reflects current code.

### 1. Jobs/Schedule/Money count mismatch — REAL, still present
- **Evidence:** Jobs page has no date filter (`jobs/page.tsx:33-42`); Schedule week grid is date-bounded (`schedule/page.tsx:83-95`); "All scheduled dates (N)" counts only `initialJobs` (current week) → shows "(0)". Money's "outstanding" = SENT quotes + unpaid invoices + COMPLETED-without-invoice jobs only (`money/page.tsx:44-100`).
- **Root cause:** Three different querysets, no shared source of truth. `isJobOverdue` uses server-UTC `new Date()` (utils.ts:248-252).
- **Fix:** Pass `totalCount` to the count button or relabel "This week's dates"; add "Scheduled, not yet invoiced" card on Money; make `isJobOverdue` use business timezone. **Effort:** M

### 2. Mixed time formats ("10:00 AM" vs "09:00") — REAL, still present
- **Evidence:** Jobs list uses `formatJobTime` → "10:00 AM" (`jobs/page.tsx:179`); Schedule renders raw storage → "09:00" (`ScheduleClient.tsx:347`).
- **Root cause:** `formatJobTime` falls through raw for legacy non-canonical values (utils.ts:71). Times stored as plain text, not normalized.
- **Fix:** Use `formatJobTime` at ScheduleClient.tsx:347 and other raw spots; one-time legacy normalization. **Effort:** S

### 3. Floating mascot/robot covering content — REAL, still present
- **Evidence:** Jobi fixed bottom-left z-40 (`JobiMascot.tsx:294-302`); Copilot trigger fixed bottom-right z-50 (`GlobalCopilotWidget.tsx:1505`).
- **Root cause:** `1188a77` only lowered Jobi zIndex 60→40; no content offset added anywhere.
- **Fix:** Add bottom padding/spacer to app shell; don't just lower z-index. **Effort:** S

### 4. Duplicate "Schedule new job" + duplicate date navigator — FIXED in code
- **Evidence:** `1188a77` removed duplicates from ScheduleClient. One of each remains.
- **Status:** Needs live verification (deploy stalled).

### 5. Today not highlighted — FIXED in code
- **Evidence:** Root cause was `border-smoke` (nearly invisible); now `border-lime-500 bg-lime-50` (page.tsx:274).
- **Status:** Needs live verification.

### 6. Holiday chip truncated ("Than...") — REAL, still present
- **Evidence:** `max-w-[72px] truncate` at `schedule/page.tsx:317`; `hidden sm:inline` hides name on mobile entirely.
- **Fix:** Raise cap to ~120px; show name on mobile. **Effort:** S

### 7. $0 job saved with no warning — WARNING NOW EXISTS in code
- **Evidence:** `JobForm.tsx:86-89, 214-219` added by `1188a77`. Schema intentionally allows 0 (`min(0)`, validations.ts:44-49).
- **Status:** Needs live verification.

### 8. Status filter order/caps differ — FIXED in code
- **Evidence:** Both pages now use identical order + Title-Case `formatStatusLabel` (utils.ts:86-95).
- **Minor drift risk:** ScheduleClient keeps own `STATUS_TABS` const (ScheduleClient.tsx:45) instead of importing `JOB_STATUSES`.
- **Status:** Needs live verification.

### 9. Em dashes / en dashes in UI copy — REAL, still present
- **Evidence:** 867 em dashes / 17 en dashes in src; zero in `.tsx` files. User-visible: 53 in `src/lib/i18n/` (e.g., "Fill the essentials — under 20 seconds."), email templates, help articles. En dashes in `working-hours.ts:102-104` ("Mon–Fri · 9:00 AM – 6:00 PM").
- **Fix:** Hyphen-only for user-facing copy. **Effort:** S (bulk replace in i18n files)

### 10. Two product names (Kivo / EveryJob) — nearly clean
- **Evidence:** "Kivo" appears in exactly 1 user-facing-adjacent place: a code comment (`directory.ts:102`). Remainder are infra identifiers (cookie `kivo_session`, env `KIVO_ADMIN_EMAILS`) + production hostname `kivo-nine-silk.vercel.app`. "EveryJob" in 159 files.
- **Fix:** Reword comment; rename cookies/env on session-rotation boundary. **Effort:** S

---

## Step 6. Security Scan (Read-Only)

### Secrets
- **Zero** `NEXT_PUBLIC_*` variables in `src/`.
- `.env.example` lists 17 expected vars (placeholders only).
- Gitleaks not available; full git history scan not run.
- **Risk:** Low.

### Authentication
- **Login errors:** Generic on both surfaces. Business: "Incorrect email or password." (auth.ts:133). Customer: "Invalid email or password." (customer-auth.ts:90). Dummy-hash compare for unknown emails (no enumeration).
- **Password rules:** Business min 15 chars + letter + digit (validations.ts:136-148). Customer min 8 (customer-auth.ts:44). Bcrypt cost 12.
- **Rate limiting:** Per-IP and per-email, 8 attempts / 10 min (rate-limit.ts:50) on register/login both surfaces. **Known gap:** In-memory buckets per serverless instance (rate-limit.ts:1-15) — advisory under burst until shared store exists.
- **Session cookies:** `httpOnly`, `secure` in production, `sameSite: 'lax'` (auth.ts:24-30, customer-auth.ts:36-42).
- **Password reset:** 1h TTL, SHA-256-hash-stored tokens, single-use via `usedAt`, invalidates all sessions on use.
- **Risk:** Low (Medium pre-scale for rate limiting).

### Destructive Flows
- **Customer delete:** **Blocked, no cascade.** Refuses when jobs/invoices/quotes exist, cites CRA 6-year rule (customers.ts:169, 189-196).
- **Invoice delete:** Blocked when PAID (invoices.ts:316) and when any payment exists, covering partially-paid (invoices.ts:317-329). **Gap:** Error message says "Void it instead" but **no void flow exists** anywhere in the codebase. Partially-paid invoices are currently undeletable and unvoidable.
- **Risk:** Low integrity / UX gap.

### Security Headers (Production)
`curl -I https://kivo-nine-silk.vercel.app/` (2026-10-13):
- **Present:** HSTS (max-age=63072000, preload), X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy (camera/mic off)
- **Absent:** Content-Security-Policy (documented as intentional in next.config.ts:7-8)
- **Risk:** Low; CSP is the one remaining gap.

### Dependencies
- `npm audit` **failed** — sandbox registry policy blocks the audit endpoint (403). Counts unknown, **not clean**. Must be run in CI or locally with registry access.

### Vercel Deployment
- Publicly reachable (expected for public SaaS). `/login` returns 200.
- **Deploy status:** Appears **stalled** as of 2026-10-13 ~20:50 EDT. Production bundle still serves pre-fix code ~2h after push 5898475. User action needed: check Vercel dashboard.

---

## Step 7. Jobber-Class Gap Check

| # | Capability | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Recurring jobs | **Present** | src/app/actions/recurring.ts + UI at src/app/(app)/recurring/ |
| 2 | Client portal | **Present (partial)** | Magic-link `/portal/[token]`; quote approval `/q/[token]`; e-sign `/sign/[token]`; Stripe pay via `/api/pay/*` |
| 3 | PDF quotes/invoices | **Missing** | No PDF library in package.json or src/ |
| 4 | Job assignment/roles | **Present (partial)** | `assignedToId`/`crewId` on Job; only ADMIN/MEMBER roles |
| 5 | Automated reminders | **Missing (by design)** | $0 rule: reminders.ts builds draft text + deep links only, never auto-sends |
| 6 | Online booking | **Present** | Public `/book/[slug]` |
| 7 | Price book | **Present** | src/app/(app)/pricebook/ |
| 8 | Accounting export | **Present (partial)** | CSV via src/lib/csv.ts; QuickBooks via src/lib/quickbooks.ts |
| 9 | Reports | **Present** | Report builder at src/app/(app)/reports/ |
| 10 | Audit log | **Partial** | PiaAuditLog covers view/export/search only; no CRUD audit |
| 11 | Archive/void vs delete | **Missing** | Zero `deletedAt` columns; all hard deletes; no void flow |
| 12 | Invoice numbering | **Present** | INV-0001 per business, retry-safe |
| 13 | Time zone handling | **Present (partial)** | Business.timezone IANA + todayInTimezone; times stored as plain text |
| 14 | French completeness | **Complete** | i18n-parity test green, **0 untranslated strings** |

**Key gaps vs Jobber:** PDF generation, automated messaging (deliberate $0 constraint), soft-delete/archive, granular roles, full CRUD audit log.

---

## Prioritized Issue List

### P0 (Security, Data Loss, Wrong Money)

**P0-1: `/api/admin/migrate-cents` has no authentication**
- **What:** The one-time money-migration backfill endpoint accepts unauthenticated GET requests.
- **Evidence:** src/app/api/admin/migrate-cents/route.ts:4 — `export async function GET()` with no `getSession()` or token check.
- **Root cause:** Temporary endpoint created for migration; auth was removed for deploy-trigger convenience.
- **Fix:** Delete the route immediately (migration dual-write is active; backfill can run via script). **Effort:** S

**P0-2: Money migration incomplete — historical data not backfilled, reads not switched**
- **What:** `*Cents` columns exist and new writes dual-write, but historical rows have NULL cents and all 164 display sites read Float.
- **Evidence:** Schema has 19 `*Cents` columns; backfill endpoint returns 404 (deploy stalled); `formatMoney` called with Float values throughout.
- **Root cause:** Phased migration paused at Phase 2 (dual-write).
- **Fix:** (1) Run backfill on local/staging; (2) switch reads to cents with Float fallback; (3) remove Float columns after verification. **Effort:** L
- **Note:** User explicitly said pending steps are not deferred — migration stays open.

**P0-3: Next.js security upgrade needed (16.3.6 → 16.3.8)**
- **What:** Sept 30 2026 release fixes 7 advisories including 1 high (SSRF CVE-2026-94483).
- **Evidence:** Installed 16.3.6; 16.3.8 available with fixes.
- **Fix:** `npm install next@16.3.8`, run full CI, deploy. Requires user approval per dependency rule. **Effort:** S

### P1 (Broken Flows)

**P1-1: Jobs/Schedule/Money count mismatch**
- **What:** Same jobs counted differently on three pages; Schedule shows "(0)" for all-scheduled-dates.
- **Evidence:** Step 5, Issue 1. Different querysets; `isJobOverdue` uses server UTC.
- **Fix:** Shared count logic; business-timezone overdue; "Scheduled, not yet invoiced" Money card. **Effort:** M

**P1-2: Partially-paid invoices undeletable and unvoidable**
- **What:** Delete blocked (correct), but error says "Void it instead" and no void flow exists.
- **Evidence:** src/app/actions/invoices.ts:317-329; zero void actions repo-wide.
- **Fix:** Build void-with-reason flow. **Effort:** M

**P1-3: Vercel deploy stalled**
- **What:** Production serves pre-fix code ~2h after push. Launch-pack fixes cannot be live-verified.
- **Evidence:** Live bundle check 2026-10-13 ~20:50 EDT; chunk still has pre-fix markers.
- **Fix:** User checks Vercel dashboard (build logs, stuck/queued status); redeploy or cancel stuck build. **Effort:** S (user action)

**P1-4: Mixed time formats in lists**
- **What:** "10:00 AM" and "09:00" in same list.
- **Evidence:** Step 5, Issue 2. `formatJobTime` not applied consistently; times stored as plain text.
- **Fix:** Apply `formatJobTime` at all render sites; normalize legacy values. **Effort:** S

### P2 (UX and Polish)

**P2-1: Floating buttons cover content**
- **What:** Jobi (z-40) and Copilot trigger (z-50) overlay page content on mobile.
- **Evidence:** Step 5, Issue 3. No content offset in app shell.
- **Fix:** Add bottom padding/spacer to app shell. **Effort:** S

**P2-2: Em dashes / en dashes in user-facing copy**
- **What:** 867 em dashes / 17 en dashes in src; 53 user-visible in i18n files.
- **Evidence:** Step 5, Issue 9. e.g., "Fill the essentials — under 20 seconds."
- **Fix:** Bulk hyphen replacement in `src/lib/i18n/`, email templates, help articles. **Effort:** S

**P2-3: Holiday chip truncated**
- **What:** "Thanksgiving" shows as "Than..." on schedule.
- **Evidence:** `max-w-[72px] truncate` at schedule/page.tsx:317.
- **Fix:** Raise to ~120px; show on mobile. **Effort:** S

**P2-4: No Content-Security-Policy header**
- **What:** CSP absent from production headers (intentional per next.config.ts:7-8).
- **Evidence:** `curl -I` output.
- **Fix:** Add CSP policy; test thoroughly (risk of breaking inline scripts). **Effort:** M

**P2-5: Rate limiting uses in-memory buckets**
- **What:** Per-instance memory store; advisory under serverless burst.
- **Evidence:** src/lib/rate-limit.ts:1-15.
- **Fix:** Shared store (Redis/Upstash) when scaling. **Effort:** M (deferred pre-scale)

**P2-6: No PDF generation**
- **What:** Cannot export quotes/invoices as PDF.
- **Evidence:** No PDF library in package.json.
- **Fix:** Add PDF library (requires user approval per dependency rule). **Effort:** M

**P2-7: No soft-delete / archive**
- **What:** All deletes are hard; zero `deletedAt` columns.
- **Evidence:** Schema grep; Step 7, Item 11.
- **Fix:** Add `deletedAt` + archive UI; migrate existing deletes. **Effort:** L

---

## Questions for the User

1. **Money migration — backfill:** The backfill endpoint is deployed but Vercel returns 404 (deploy stalled). Once the deploy lands, should I run the historical backfill automatically, or do you want to trigger it manually?

2. **Money migration — read switching:** Should the 164 display sites be switched to read from `*Cents` columns (with Float fallback) right after this audit, or explicitly deferred? This touches production financial reads.

3. **Next.js upgrade:** May I upgrade Next.js 16.3.6 → 16.3.8 (7 security advisories, 1 high)? This requires your approval per the dependency rule.

4. **PDF library:** May I add a PDF generation dependency for quotes/invoices? Which do you prefer: `pdfkit`, `@react-pdf/renderer`, or another?

5. **Vercel deploy:** The production deploy appears stalled (still serving pre-fix code 2h after push). Can you check the Vercel dashboard for failed/stuck builds and redeploy if needed?

6. **CSP header:** Should I add a Content-Security-Policy header? It improves security but risks breaking inline scripts — needs careful testing.

7. **Void flow:** For the "Void it instead" invoice message — should I build a void-with-reason flow, or change the error message to something else?

8. **Claimed inventory:** The prompt referenced a full inventory text to verify ("[PASTE THE FULL INVENTORY TEXT...]") but it was not included. Do you have that text to provide, or should Step 4 verification proceed against the known app structure?

---

*End of audit. Awaiting user answers before any fixes begin.*
