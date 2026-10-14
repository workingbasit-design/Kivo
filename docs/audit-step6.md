# Audit Step 6 — Read-only Security Scan
**Date:** 2026-10-13 (EDT) · **Scope:** read-only; no code, config, dependency, or DB changes made.

## 1. Secrets in code

**Findings:**
- `grep -rn "NEXT_PUBLIC_" src/ --include="*.ts" --include="*.tsx" | grep -iE "secret|key|token"` returned **zero hits** — there are no `NEXT_PUBLIC_*` variables at all in `src/` (the second grep for any `NEXT_PUBLIC_` also returned nothing). The client bundle contains no env-backed secrets by this measure.
- `.env.example` (`~/workspace/kivo/.env.example`) lists the expected env vars:
  - `DATABASE_URL`, `APP_BASE_URL`, `CRON_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_CLIENT_ID`, `STRIPE_WEBHOOK_SECRET`, `MESSAGING_ENC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_SANDBOX`, `SUPPORT_OWNER_EMAIL`, `RESEND_API_KEY`, `OWNER_EMAILS`.
  - The file header instructs: "Never commit real values. Generate secrets with: `openssl rand -base64 32`". No real values present in the template.
- `which gitleaks` → **not available**. Per task instructions, no git history scan was run.

**Risk note:** Low. Client-exposed secrets: none found by the specified grep. Env var discipline is documented in the project rules (`~/workspace/kivo/AGENTS.md`: "Never commit secrets. All secrets go in environment variables"). Gap: no automated secret scanning (gitleaks) is installed locally, so committed-secret regressions rely on contributor discipline.

## 2. Authentication

### 2a. Login error messages — generic, no account-existence leak
- Business login: `src/app/actions/auth.ts:133` → `return { error: 'Incorrect email or password.' };`. Unknown email, wrong password, and missing `businessId` all collapse into this one message (line 131: `if (!user || !ok || !user.businessId)`). It also hash-compares a dummy bcrypt hash for unknown emails to keep timing consistent-ish (`src/app/actions/auth.ts:128-129`).
- Customer login: `src/app/actions/customer-auth.ts:90` → `return { error: 'Invalid email or password.' };` for both missing customer and wrong password.
- No "Account not found" string appears anywhere in login paths (grep across `src/` found zero occurrences).

**Risk note:** Low. Both login surfaces use uniform error messages; user enumeration via the login error string is not possible.

### 2b. Password rules
- Business registration: `src/lib/validations.ts:136-148` — `registerSchema` requires password `min(15, "Password must be at least 15 characters")`, `max(128)`, at least one letter (`/[A-Za-z]/`) and at least one digit (`/\d/`).
- Customer signup: `src/app/actions/customer-auth.ts:44` — minimum **8 characters** (plus a max-length cap, `MAX_PASSWORD_LENGTH`, enforced to bound PBKDF2 CPU cost).
- Hashing: business uses bcrypt cost 12 (`src/app/actions/auth.ts:64`); reset path also bcrypt cost 12 (`src/app/actions/password-reset.ts:139`).

**Risk note:** Low for business accounts (15-char + letter+digit is strong). Note the asymmetry: customer accounts only require 8 chars — acceptable given customers hold low-privilege data, but worth stating in any customer-facing security posture.

### 2c. Rate limiting
- Implementation: `src/lib/rate-limit.ts:29` (`rateLimit(key, {limit, windowMs})`), in-memory token bucket; `AUTH_LIMIT = { limit: 8, windowMs: 10*60*1000 }` at `src/lib/rate-limit.ts:50` (8 attempts / 10 min).
- Applied per-IP **and** per-email on: business `register` and `login` (`src/app/actions/auth.ts:42` and `:57-59` for register; `:108` and `:122-123` for login) and customer `customerSignup` (`src/app/actions/customer-auth.ts:36`) and `customerLogin` (`src/app/actions/customer-auth.ts:70` and `:82-83`).
- **Known gap, documented in-code** (`src/lib/rate-limit.ts:1-15`): buckets live in per-instance memory; on Vercel serverless each concurrent instance/cold start gets its own bucket map, so the effective limit is ~N per instance. The comment states the limiter MUST move to a shared store (Upstash Redis / Vercel KV) "before any public scaling" — limits are advisory under burst traffic.

**Risk note:** Medium under scaling conditions; low at current traffic. The per-email bucket is the credential-stuffing defense and is correctly in place; the single-instance nature is the documented weakness.

### 2d. Session cookies
- Business session: `src/lib/auth.ts:24-30` — `cookieStore.set('kivo_session', session.id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', expires: expiresAt, sameSite: 'lax', path: '/' })`.
- Customer session: `src/lib/customer-auth.ts:36-42` — same flags: `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'`, `path: '/'`.
- Session lifetime: 7 days (business, `src/lib/auth.ts:15`); customer uses `SESSION_DAYS` (`src/lib/customer-auth.ts:30`).

**Risk note:** Low. Cookies are httpOnly (no JS access), SameSite=lax (CSRF mitigation for GET/navigation flows), and secure in production. Exact expiry is explicit.

### 2e. Password reset
- Token lifetime: 1 hour — `RESET_TOKEN_TTL_MS = 60 * 60 * 1000` at `src/lib/password-reset.ts:10`.
- Single-use: enforced — raw token is 32 random bytes hex (`src/lib/password-reset.ts:14-16`), only the SHA-256 hash is stored, `isResetTokenUsable()` returns false if `usedAt` is set or `expiresAt` passed (`src/lib/password-reset.ts:26-30`). On use, `resetPassword` marks `usedAt` and **deletes all existing sessions for the user** in the same transaction (`src/app/actions/password-reset.ts:143-151` — "a compromised old password must not leave live sessions behind"). Request path invalidates prior unused tokens for the user (`src/app/actions/password-reset.ts:85`).

**Risk note:** Low. Hash-stored, 1-hour TTL, single-use, session invalidation on reset — all best-practice boxes checked.

## 3. Destructive flows

### 3a. Customer delete — blocked, no cascade
- `deleteCustomer` at `src/app/actions/customers.ts:169`.
- Pre-delete check (`src/app/actions/customers.ts:176-196`): loads the customer with `jobs`, `invoices`, `quotes` (one row each via `take: 1`); if **any** exist, deletion is refused with: *"Cannot delete this customer: they have jobs, invoices, or quotes on file. Tax records must be kept for 6 years. Remove their contact details instead, or contact support."* The code comment explicitly cites the CRA 6-year record-keeping requirement. No Prisma cascade on customer delete — only customers with zero linked records reach `prisma.customer.delete` (line 199).

**Risk note:** Low. The previously feared cascade-delete is absent; deletion is fail-closed when records exist. (The business's suggested remediation — redacting contact details — is a product/UX note, not a security gap.)

### 3b. Invoice delete — blocked when paid/partially-paid; no void flow exists
- `deleteInvoice` at `src/app/actions/invoices.ts:299`.
- PAID invoices blocked: `src/app/actions/invoices.ts:316` → *"Paid invoices are kept as records and can't be deleted."*
- Invoices with **any** payments blocked: `src/app/actions/invoices.ts:317-329` counts payments and refuses with *"This invoice has payments recorded and can't be deleted. Void it instead to keep the payment history."* — this covers the partially-paid case too (a partially-paid invoice has ≥1 payment record; `deriveStatus` at `src/app/actions/invoices.ts:335-339` derives PARTIALLY PAID from `paid > 0`).
- **Void flow: not found.** A repo-wide grep for `voidInvoice|void_invoice|'VOID'|"VOID"|void invoice` returned zero hits; "void" appears only in the two error-message comments telling the user to "void it instead". There is no implemented void action/status — the message references a flow that does not exist.

**Risk note:** Low for data integrity (paid/partially-paid invoices cannot be deleted — the launch-pack requirement is satisfied). Low-medium as a UX gap: the error text directs users to a void flow that isn't implemented, so a partially-paid invoice is currently undeletable *and* unvoidable; any future void feature must preserve the audit trail as the message promises.

## 4. Security headers (production)

`curl -sI https://kivo-nine-silk.vercel.app/` (2026-10-13 ~21:42 EDT):

| Header | Present | Value |
|---|---|---|
| Strict-Transport-Security | ✅ | `max-age=63072000; includeSubDomains; preload` |
| X-Content-Type-Options | ✅ | `nosniff` |
| X-Frame-Options | ✅ | `SAMEORIGIN` |
| Referrer-Policy | ✅ | `strict-origin-when-cross-origin` |
| Permissions-Policy | ✅ | `camera=(), microphone=(), geolocation=(self), payment=()` |
| Content-Security-Policy | ❌ absent | — |

**Risk note:** Low. All baseline headers are present with strong values (2-year HSTS with preload, nosniff, SAMEORIGIN framing). The one gap is the missing **Content-Security-Policy** — the highest-value remaining header; without it, XSS mitigation relies entirely on framework defaults and sanitization. Recommend adding a CSP (even report-only first) on a later pass.

## 5. Dependencies

`npm audit --json` **failed** — the sandbox package-registry policy blocks the audit endpoint:
`403 Forbidden - POST https://registry.npmjs.org/-/npm/v1/security/audits/quick - policy_denied` ("zz_managed_internal_spaces_package_registries"). Exit produced no metadata, so high/critical counts could not be determined in this environment.

**Risk note:** Unknown (unverifiable here). npm audit must be run outside this sandbox (CI or a local machine with registry access). No dependency-count conclusion can be drawn from this step; do not report it as "clean".

## 6. Vercel deployment protection

`curl -s -o /dev/null -w "%{http_code}" https://kivo-nine-silk.vercel.app/login` → **200**.

**Risk note:** None from a deployment-protection standpoint — the production deployment is publicly reachable without Vercel Authentication/SSO gating, which is the expected state for a public SaaS login page (protection is at the app-auth layer, not the CDN layer).

## Summary of risks
| # | Area | Verdict |
|---|---|---|
| 1 | Secrets in code | Low — no `NEXT_PUBLIC_` secrets; gitleaks not installed (gap) |
| 2a | Login error messages | Low — generic messages both surfaces |
| 2b | Password rules | Low — 15-char + complexity for business; note 8-char customer minimum |
| 2c | Rate limiting | Medium (pre-scale) — per-IP + per-email present, but in-memory per-instance on serverless; migration to shared store documented as required before scaling |
| 2d | Session cookies | Low — httpOnly, secure-in-prod, SameSite=lax |
| 2e | Password reset | Low — 1h TTL, hash-stored, single-use, sessions invalidated |
| 3a | Customer delete | Low — blocked when records exist, no cascade |
| 3b | Invoice delete | Low integrity / UX gap — paid/partially-paid blocked; referenced void flow does not exist |
| 4 | Security headers | Low — strong baseline; CSP missing |
| 5 | Dependencies | Unknown — npm audit blocked by sandbox policy |
| 6 | Vercel protection | Expected — publicly reachable login (200) |
