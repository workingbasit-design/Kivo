# EveryJob Truth Audit — Steps 5 and 6

**Date:** 2026-10-13 (EDT) · **Scope:** read-only. No application code, config, dependencies, or database was changed.

**Method:** file reads plus read-only commands (grep, curl, node). All line numbers verified against the working tree at audit time.

**Context:** commit `1188a77` ("Launch pack fixes #1-15", Tue Oct 13 15:03 EDT) landed after the owner's screenshots were taken but before this audit. Issues it changed are flagged per-section as "fixed in code / needs live verification."

---

## STEP 5 — The 10 screenshot issues

### 1. Jobs shows 4 jobs (3 marked LATE) but Schedule shows "All scheduled dates (0)" and Money says nothing outstanding

**Filtering logic per page (file evidence):**

- **Jobs page** — `src/app/(app)/jobs/page.tsx:33-42`: no date filter at all. Shows every job ever. Past-dated open jobs get the red badge via `jobDisplayStatus(job.status, job.date)` (page.tsx:163), which returns `'LATE'` when `isJobOverdue()` is true (`src/lib/utils.ts:278-284`).
- **Schedule page** — `src/app/(app)/schedule/page.tsx:83-95`: week grid query is date-bounded (`date: { gte: weekStart, lt: weekEnd }`). Jobs dated Sep 30 / Oct 4 / Oct 7 (before the current week) are excluded. The "All scheduled dates (N)" button in `src/components/ScheduleClient.tsx` (~line 218) renders `({initialJobs.length})` — but `initialJobs` is only the current-week query result, so it prints "(0)". A separate overdue section exists (`page.tsx:96-117`, rendered page.tsx:179-216) but the "(0)" label contradicts it.
- **Money page** — `src/app/(app)/money/page.tsx:44-100`: "outstanding" = open quotes (`status: 'SENT'`, page.tsx:47-50) + unpaid invoices (`status: { not: 'PAID' }`, page.tsx:51-54) + overdue invoices (page.tsx:56-76) + unbilled jobs (`status: 'COMPLETED'` AND `invoices: { none: {} }`, page.tsx:77-95). Open NEW/SCHEDULED jobs with no invoice are in none of these buckets — "all caught up" is the legitimate result.
- **Bonus timezone bug:** `isJobOverdue` (utils.ts:248-252) defaults "today" to `new Date()` — server-local (UTC on Vercel). After ~7-8 PM Toronto time, a job dated *today* in the business timezone can flip LATE.

**Root cause:** three screens, three different definitions of "what counts" — Jobs = everything ever; Schedule week grid = this week only (plus a count label that lies about its scope); Money = invoices/quotes/completed work only. Scheduled-but-uninvoiced work is invisible to Money.

**Proposed fix (not applied):**
- Pass the already-fetched `totalCount` (page.tsx:95) into the "All scheduled dates" button, or relabel it "This week's dates."
- Add a "Scheduled, not yet invoiced" card on Money counting open jobs with summed price.
- Make `isJobOverdue`'s default "now" use the business timezone (`todayInTimezone`) instead of server-local `new Date()` (utils.ts:248-252).

---

### 2. Job times in two formats ("10:00 AM" and "09:00") in the same list

**What the code shows:**

- Jobs list renders `formatJobTime(job.time, locale)` (`src/app/(app)/jobs/page.tsx:179`). `formatJobTime` (`src/lib/utils.ts:57-73`): canonical `"HH:MM"` → `"10:00 AM"` (en) / `"10 h 00"` (fr); any non-canonical stored value falls through raw (`if (!m) return t;`, utils.ts:71).
- Schedule list renders the raw stored value: `{hasJobTime(job.time) ? job.time : T('schedTimeTbd')}` (`src/components/ScheduleClient.tsx:347`) → `"09:00"`.
- Writes are normalized via `normalizeJobTime` (`src/app/actions/jobs.ts:128, 233, 332` → `src/lib/utils.ts:31-55`), but legacy rows (pre-normalization, Copilot-booked as `"10:00 AM"` / `"2pm"`) still sit in the column.
- Other raw-render spots: export rows `time: j.time ?? ''` (jobs/page.tsx:78), owner dashboard `j.time || "-"` (owner/page.tsx:279), WhatsApp messages (`jobs/[id]/page.tsx:222, 230`).

**Root cause:** two different display paths — Jobs formats (`"10:00 AM"`), Schedule shows storage format (`"09:00"`); and `formatJobTime`'s raw-fallback (utils.ts:71) lets legacy non-canonical values leak through unformatted.

**Proposed fix (not applied):** use `formatJobTime(job.time, locale)` at ScheduleClient.tsx:347 (and the other raw spots); run a one-time normalization of legacy `time` values to canonical `"HH:MM"` (local/staging first, per DB rules).

---

### 3. Floating mascot (bottom-left) and robot button (bottom-right) covering content

**What the code shows:**

- Jobi mascot: `src/components/mascot/JobiMascot.tsx:294-302` — `position: 'fixed', left: 'max(1rem, env(safe-area-inset-left))', bottom: 'max(5.5rem, env(safe-area-inset-bottom))', zIndex: 40`. Dismissed-state restore dot at JobiMascot.tsx:266-284 (same corner, `zIndex: 40`). Mounted in root `src/app/layout.tsx:115` — on every page.
- Copilot ("robot") trigger: `src/components/GlobalCopilotWidget.tsx:1505` — `className="fixed right-4 md:bottom-10 md:right-10 bottom-[calc(6rem+env(safe-area-inset-bottom))] w-14 h-14 ... z-50"`.
- Commit `1188a77` only lowered Jobi's `zIndex` 60 → 40; both remain fixed overlays on every screen, and no page reserves bottom padding for them.

**Root cause:** two independent always-on fixed overlays (left z-40, right z-50) with no content offset, no collision handling, no per-page opt-out.

**Proposed fix (not applied):** add `pb-24`-ish bottom padding (or a spacer) to the app shell so content never sits under the buttons; consider consolidating to one floating action cluster or auto-hiding Jobi when the copilot panel is open / on bottom scroll. Do NOT just keep lowering z-index — content will still be covered, just under modals.

---

### 4. Schedule has two "Schedule new job" buttons and two date navigators

**Current state: FIXED in code by `1188a77`** (pushed Oct 13 ~15:03 EDT, after the screenshots).

Before the fix, `src/components/ScheduleClient.tsx` contained both a second day stepper (`shiftSelectedDay`, `handlePrevDay`, `handleNextDay`, `setSelectedDate('TODAY')`, old lines ~73-153) and a second "Schedule new job" `<Link href="/jobs/new">` (old line ~150-152).

Current state (verified): exactly one "Schedule new job" — `src/app/(app)/schedule/page.tsx:172-174` (PageHeader action). Exactly one week navigator — `src/app/(app)/schedule/page.tsx:226-254` (prev/next week arrows + "This week" + 7-day strip).

**Root cause:** duplicated CTA + duplicated day-stepper added to ScheduleClient on top of the page-level header/navigator.

**Proposed fix:** nothing to fix in code — verify live on production. Optionally remove the dead `'TODAY'` default in ScheduleClient.tsx:69 to prevent regression.

---

### 5. No day highlighted as today in week strip

**What the code shows:**

- `src/app/(app)/schedule/page.tsx:59`: `const todayKey = todayInTimezone(business?.timezone, business?.regionCode);` (business timezone; `todayInTimezone` at `src/lib/utils.ts:177-180`).
- `src/app/(app)/schedule/page.tsx:260`: `const isToday = key === todayKey;`
- Highlight classes — `page.tsx:274`: `isToday && !isActive && 'border-lime-500 bg-lime-50'`, plus lime text at page.tsx:280 (`text-lime-700`) and page.tsx:288 (`text-lime-800`); aria-label announces "Today" (page.tsx:268).

**Root cause of the screenshot:** before `1188a77`, the highlight was `isToday && !isActive && 'border-smoke'` — a nearly invisible gray border that read as "no highlight." The commit replaced it with `border-lime-500 bg-lime-50` + lime text. The business-timezone `todayKey` itself was already correct.

**Proposed fix:** nothing to fix in code — verify live that today's tile shows the lime ring.

---

### 6. Holiday chip truncated to "Than..."

**What the code shows** — `src/app/(app)/schedule/page.tsx:311-319`:
```tsx
<span className="hidden sm:inline max-w-[72px] truncate">{holiday}</span>
```
(page.tsx:317). The name span has `max-w-[72px]` + `truncate`, so "Thanksgiving" clips to "Than…". Additionally `hidden sm:inline` hides the name entirely on mobile (emoji only). `title`/`aria-label` keep the full name for hover/screen readers only.

**Root cause:** the 72px cap + truncation; plus the mobile-hidden class.

**Proposed fix (not applied):** raise/relax the cap (e.g. `max-w-[120px]`) or let the chip wrap to two lines on `md+`; on mobile remove `hidden sm:inline` in favor of a smaller truncation (e.g. `max-w-[64px]`). Keep `title={holiday}` as fallback.

---

### 7. $0.00 job saved with no warning

**What the code shows:**

- Price validation — `src/lib/validations.ts:44-49` (`jobSchema`): `price: z.coerce.number().min(0, "Price can't be negative").max(10_000_000)...` — **`min(0)` explicitly allows $0.00** (same for `serviceSchema` line 57, `quoteSchema` ~line 66). Only negatives are rejected.
- `src/components/JobForm.tsx` now contains a zero-price warning (added in `1188a77`): detection at JobForm.tsx:86-89 (`priceIsZero`), warning UI at JobForm.tsx:214-219 — amber `role="alert"` box with `{T('formZeroPriceWarning')}` under the price field.

**Root cause of the screenshot:** at screenshot time there was no zero-price warning — `min(0)` passed silently.

**Proposed fix:** nothing further required client-side — verify the amber warning appears live when typing `0`. Optional hardening: the warning is client-only; a server action saving `price: 0` directly won't trigger it. If the product rule is "warn, don't block," current state is correct.

---

### 8. Status filters ordered differently on Jobs vs Schedule, labels all caps

**What the code shows:**

- Jobs tabs: `src/app/(app)/jobs/page.tsx:142` → `['ALL', ...JOB_STATUSES]`, with `JOB_STATUSES = ["NEW","SCHEDULED","IN PROGRESS","COMPLETED","PAID","CANCELLED"]` (`src/lib/validations.ts:3-10`).
- Schedule tabs: `src/components/ScheduleClient.tsx:45` → `const STATUS_TABS = ['ALL', 'NEW', 'SCHEDULED', 'IN PROGRESS', 'COMPLETED', 'PAID', 'CANCELLED']` — identical order.
- Both render labels via `formatStatusLabel(st, locale)` (jobs/page.tsx:151, ScheduleClient.tsx:258) → Title Case: "In progress" / "En cours" (`src/lib/utils.ts:86-95`, added in `1188a77`).

**Root cause of the screenshot:** before `1188a77`, ScheduleClient's tabs were `['ALL','SCHEDULED','IN PROGRESS','NEW','COMPLETED']` (different order; PAID/CANCELLED missing) and labels were raw SCREAMING_CASE ("IN PROGRESS"). `1188a77` aligned the array and added Title-Case labels on both screens.

**Proposed fix:** nothing to fix in code — verify live. Minor: ScheduleClient keeps its own `STATUS_TABS` const instead of importing `JOB_STATUSES`; consider importing the single source of truth to prevent future drift.

---

### 9. Em dashes and en dashes in UI copy

**Counts (2026-10-13, current tree):**
- Em dash `—` in `src/**/*.tsx|ts`: **867** occurrences
- En dash `–` in `src/**/*.tsx|ts`: **17** occurrences
- Translations live in `src/lib/i18n/` (`en.ts`, `fr.ts`, `fragments/`); there is no `src/messages/` dir. Inside `src/lib/i18n/`: **53** em dashes, **0** en dashes.
- **Zero `.tsx` files contain an em dash** (`grep -rln "—" src/ --include='*.tsx'` → empty). All em dashes are in `.ts` files.

**Top files (em dash count):** `src/lib/copilot/engine.ts` (100), `src/lib/help-articles.ts` (65), `src/lib/copilot/parse.ts` (45), `src/lib/messaging/email-templates.ts` (30), `src/lib/i18n/fr.ts` (27), `src/lib/i18n/en.ts` (26), `src/app/api/copilot/route.ts` (20), `src/lib/tenant-guard.ts` (15).

**User-visible occurrences:** i18n strings — e.g. `newJobSubtitle: 'Fill the essentials — under 20 seconds.'` (en.ts:76), `errorRetry: 'Could not book the job — please try again.'` (en.ts:166); email templates; help articles. En dashes in UI-rendered strings: `src/lib/working-hours.ts:102-104` (`Mon–Fri · 9:00 AM – 6:00 PM`), `src/lib/messaging/engine.ts:591` (`Quiet hours (9:00–17:00 …)`). The bulk of the 867 is Copilot-internal prompts/comments.

**Root cause:** no style rule; copy written with em/en dashes across AI prompts, i18n strings, and comments alike.

**Proposed fix (not applied):** adopt hyphen-only for user-facing copy: replace `—`/`–` in `src/lib/i18n/en.ts`, `src/lib/i18n/fr.ts`, `src/lib/i18n/fragments/*.ts`, email templates, help articles, and UI-rendered helpers (`working-hours.ts`, `messaging/engine.ts:591`). Copilot-internal system prompts and code comments are low priority (or normalize for consistency).

---

### 10. Two product names (Kivo and EveryJob)

**Counts:**
- Case-sensitive `"Kivo"`: **1 file** — `src/app/actions/directory.ts:102`, a code comment: `/** Phone validation — Canada-only. The old IN fallback was pre-Canada Kivo ... */`. Not user-facing.
- Case-sensitive `"EveryJob"`: **159 files**.
- Case-insensitive matches are all technical identifiers, none user-facing: `kivo-locale` (cookie, 16), `kivo_session` / `kivo_customer_session` (cookies, 8+2), `KIVO_ADMIN_EMAILS` (env var, 7), `kivo-outbox` (queue, 1), and `kivo-nine-silk.vercel.app` (the Vercel deployment hostname, ~10 references in sitemap/robots/meta).

**Root cause:** leftover from the Sep 2026 Kivo → EveryJob rename: one stale comment and infra identifiers (cookies/env/queue names) still use the old name. The production URL itself is `kivo-nine-silk.vercel.app` — the deployment hostname, not UI copy, but users see it in the address bar.

**Proposed fix (not applied):** reword the directory.ts:102 comment; rename cookies/env/queue on a major version boundary (they're stored client-side / in env — renaming breaks existing sessions, so keep until a session rotation); long-term, point production at an everyjob.* hostname since the address bar still says "kivo".

---

## STEP 6 — Read-only security scan

### 1. Secrets in code

- `grep -rn "NEXT_PUBLIC_" src/ --include="*.ts" --include="*.tsx" | grep -iE "secret|key|token"` → **zero hits** — there are no `NEXT_PUBLIC_*` variables at all in `src/`. The client bundle contains no env-backed secrets by this measure.
- `.env.example` lists 17 expected env vars: `DATABASE_URL`, `APP_BASE_URL`, `CRON_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_CLIENT_ID`, `STRIPE_WEBHOOK_SECRET`, `MESSAGING_ENC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_SANDBOX`, `SUPPORT_OWNER_EMAIL`, `RESEND_API_KEY`, `OWNER_EMAILS`. Header instructs: "Never commit real values. Generate secrets with: `openssl rand -base64 32`." No real values in the template.
- `which gitleaks` → **not available**. No git history scan was run.

**Risk: Low.** Gap: no automated secret scanning installed locally; committed-secret regressions rely on contributor discipline.

### 2. Authentication

**2a. Login error messages — generic, no account-existence leak.**
- Business login: `src/app/actions/auth.ts:133` → `return { error: 'Incorrect email or password.' };`. Unknown email, wrong password, and missing `businessId` all collapse into one message (`src/app/actions/auth.ts:131`). Dummy bcrypt hash compared for unknown emails to keep timing consistent-ish (auth.ts:128-129).
- Customer login: `src/app/actions/customer-auth.ts:90` → `return { error: 'Invalid email or password.' };` for both missing customer and wrong password.
- No "Account not found" string anywhere in login paths (grep found zero occurrences).

**Risk: Low.**

**2b. Password rules.**
- Business registration: `src/lib/validations.ts:136-148` — `min(15, "Password must be at least 15 characters")`, `max(128)`, at least one letter (`/[A-Za-z]/`), at least one digit (`/\d/`).
- Customer signup: `src/app/actions/customer-auth.ts:44` — minimum **8 characters** (plus max-length cap for PBKDF2 CPU cost).
- Hashing: business bcrypt cost 12 (`src/app/actions/auth.ts:64`); reset path also bcrypt cost 12 (`src/app/actions/password-reset.ts:139`).

**Risk: Low** for business (15-char + complexity is strong). Note asymmetry: customer accounts only require 8 chars — acceptable given low-privilege data, but worth stating.

**2c. Rate limiting.**
- `src/lib/rate-limit.ts:29` (`rateLimit(key, {limit, windowMs})`); `AUTH_LIMIT = { limit: 8, windowMs: 10*60*1000 }` at rate-limit.ts:50 (8 attempts / 10 min).
- Applied per-IP **and** per-email on business `register`/`login` (`src/app/actions/auth.ts:42, 57-59, 108, 122-123`) and customer `customerSignup`/`customerLogin` (`src/app/actions/customer-auth.ts:36, 70, 82-83`).
- **Known documented gap** (rate-limit.ts:1-15): buckets live in per-instance memory; on Vercel serverless each concurrent instance gets its own bucket map, so limits are advisory under burst traffic. The comment states the limiter MUST move to a shared store (Upstash Redis / Vercel KV) "before any public scaling."

**Risk: Medium under scaling; low at current traffic.** Per-email bucket (the credential-stuffing defense) is correctly in place; single-instance nature is the documented weakness.

**2d. Session cookies.**
- Business: `src/lib/auth.ts:24-30` — `cookieStore.set('kivo_session', session.id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', expires: expiresAt, sameSite: 'lax', path: '/' })`.
- Customer: `src/lib/customer-auth.ts:36-42` — same flags: `httpOnly: true`, `secure` in production, `sameSite: 'lax'`, `path: '/'`.
- Session lifetime: 7 days (business, auth.ts:15); customer uses `SESSION_DAYS` (customer-auth.ts:30).

**Risk: Low.** httpOnly (no JS access), SameSite=lax (CSRF mitigation), secure in production.

**2e. Password reset.**
- Token lifetime: 1 hour — `RESET_TOKEN_TTL_MS = 60 * 60 * 1000` at `src/lib/password-reset.ts:10`.
- Single-use: 32 random bytes hex (password-reset.ts:14-16), only SHA-256 hash stored; `isResetTokenUsable()` returns false if `usedAt` set or `expiresAt` passed (password-reset.ts:26-30). On use, `resetPassword` marks `usedAt` and **deletes all existing sessions for the user** in the same transaction (`src/app/actions/password-reset.ts:143-151`). Request path invalidates prior unused tokens (password-reset.ts:85).

**Risk: Low.** Hash-stored, 1-hour TTL, single-use, sessions invalidated on reset.

### 3. Destructive flows

**3a. Customer delete — blocked, no cascade.**
- `deleteCustomer` at `src/app/actions/customers.ts:169`.
- Pre-delete check (customers.ts:176-196): loads customer with `jobs`, `invoices`, `quotes` (one row each via `take: 1`); if any exist, deletion is refused: *"Cannot delete this customer: they have jobs, invoices, or quotes on file. Tax records must be kept for 6 years. Remove their contact details instead, or contact support."* Code comment cites CRA 6-year record-keeping. No Prisma cascade — only customers with zero linked records reach `prisma.customer.delete` (line 199).

**Risk: Low.** The feared cascade-delete is absent; deletion is fail-closed.

**3b. Invoice delete — blocked when paid/partially-paid; no void flow exists.**
- `deleteInvoice` at `src/app/actions/invoices.ts:299`.
- PAID invoices blocked: invoices.ts:316 → *"Paid invoices are kept as records and can't be deleted."*
- Invoices with any payments blocked: invoices.ts:317-329 counts payments and refuses with *"This invoice has payments recorded and can't be deleted. Void it instead to keep the payment history."* — covers the partially-paid case (partially-paid = ≥1 payment record; `deriveStatus` at invoices.ts:335-339 derives PARTIALLY PAID from `paid > 0`).
- **Void flow: not found.** Repo-wide grep for void actions returned zero hits; "void" appears only in the error-message comments telling the user to "void it instead."

**Risk: Low for data integrity** (paid/partially-paid invoices cannot be deleted — launch-pack requirement satisfied). **UX gap:** the error text directs users to a void flow that doesn't exist, so a partially-paid invoice is currently undeletable *and* unvoidable; any future void feature must preserve the audit trail.

### 4. Security headers (production)

`curl -sI https://kivo-nine-silk.vercel.app/` (2026-10-13 ~21:42 EDT):

| Header | Present | Value |
|---|---|---|
| Strict-Transport-Security | ✅ | `max-age=63072000; includeSubDomains; preload` |
| X-Content-Type-Options | ✅ | `nosniff` |
| X-Frame-Options | ✅ | `SAMEORIGIN` |
| Referrer-Policy | ✅ | `strict-origin-when-cross-origin` |
| Permissions-Policy | ✅ | `camera=(), microphone=(), geolocation=(self), payment=()` |
| Content-Security-Policy | ❌ absent | — |

**Risk: Low.** Strong baseline (2-year HSTS with preload, nosniff, SAMEORIGIN). The one gap is the missing **Content-Security-Policy** — recommend adding (even report-only first) on a later pass.

### 5. Dependencies

`npm audit --json` **failed** — the sandbox package-registry policy blocks the audit endpoint (`403 Forbidden ... policy_denied`). High/critical counts could not be determined in this environment.

**Risk: Unknown (unverifiable here).** npm audit must be run outside this sandbox (CI or a local machine with registry access). Do not report as "clean."

### 6. Vercel deployment protection

`curl -s -o /dev/null -w "%{http_code}" https://kivo-nine-silk.vercel.app/login` → **200**.

**Risk: none from deployment protection** — publicly reachable login is the expected state for a public SaaS page (protection is at the app-auth layer, not the CDN layer).

---

## Summary

**Step 5:** Issues 4, 5, 7, 8 were fixed in code by commit `1188a77` (after the screenshots, before this audit) and need live verification. Issues 1, 2, 3, 6, 9, 10 have real remaining gaps; none were changed by this audit. Per standing rules, each proposed fix needs per-item approval plus live production verification — commit state ≠ shipped-and-seen.

**Step 6 risk table:**

| # | Area | Verdict |
|---|---|---|
| 1 | Secrets in code | Low — no `NEXT_PUBLIC_` secrets; gitleaks not installed (gap) |
| 2a | Login error messages | Low — generic messages both surfaces |
| 2b | Password rules | Low — 15-char + complexity (business); note 8-char customer minimum |
| 2c | Rate limiting | Medium (pre-scale) — per-IP + per-email present; in-memory per-instance on serverless |
| 2d | Session cookies | Low — httpOnly, secure-in-prod, SameSite=lax |
| 2e | Password reset | Low — 1h TTL, hash-stored, single-use, sessions invalidated |
| 3a | Customer delete | Low — blocked when records exist, no cascade |
| 3b | Invoice delete | Low integrity / UX gap — paid/partially-paid blocked; referenced void flow does not exist |
| 4 | Security headers | Low — strong baseline; CSP missing |
| 5 | Dependencies | Unknown — npm audit blocked by sandbox policy |
| 6 | Vercel protection | Expected — publicly reachable login (200) |

Working files: `docs/audit-step5.md`, `docs/audit-step6.md` (per-section detail for each).
