# Kivo Release QA — Test Report
**Date:** 2026-09-22 · **Stack:** Next.js 16.3.5 / React 19.2.8 / TS 5 / Prisma 5.22 / SQLite
**Scope:** Workstream D — final QA/adversarial release-readiness pass
**Tenants:** `QARel IN Services` (IN) and `QARel CA Services` (CA/QC) — both created for this pass and **deleted afterwards**. Demo tenant `Sharma Home Services` untouched.
**Evidence:** `~/workspace/kivo-shots/release/` · **Harness:** `~/workspace/kivo-shots/qa/`
**TypeScript:** `npx tsc --noEmit` (un-piped) — **clean, 0 errors** at end of pass.

> Note: earlier automated runs logged FAILs that were harness artifacts (wrong selectors, stale IDs,
> dev-mode JS noise, rate-limit windows, server restarts). Every observed FAIL below was either fixed
> in the app and retested, or re-verified as a harness mistake. Only the final verified state is reported.

---

## 1. Positive — IN core flow
[PASS] area — IN: registration validation rejects bad input; valid registration creates business+user — evidence (20-in-register.png)
[PASS] area — IN: customer create via UI — evidence (30-in-customer.png)
[PASS] area — IN: job create via UI — evidence (35-in-job.png)
[PASS] area — IN: quote create; line math 2×1200+800=3200 — evidence (40-in-quote.png)
[PASS] area — IN: invoice create; subtotal 2500 + GST 450 = 2950 — evidence (45-in-invoice.png)
[PASS] area — IN: full payment flips invoice to PAID — evidence (46-in-paid.png)
[PASS] area — IN: invoice share token + unauthenticated public portal — evidence (47-in-public-invoice.png)
[PASS] area — IN: schedule status transition SCHEDULED → IN PROGRESS — evidence (48-in-status.png)
[PASS] area — IN: quote share token; SENT quote approved via public portal (Prisma: APPROVED) — evidence (50-in-quote-sent.png)
[PASS] area — IN: review created via UI — evidence (56-in-review.png)
[PASS] area — IN: tax library matrix — 21 pass / 0 fail (all CA provinces/territories, IN slabs, defaults, rounding, large values) — evidence (tax-verify.cjs)
[PASS] area — IN: marketing draft saves; wa.me link correctly encoded — evidence (57-in-campaign-draft.png)
[PASS] area — IN: timesheet clock in/out — evidence (59-in-timesheet-clockin.png, 60-in-timesheet-clockout.png)
[PASS] area — IN: route optimization completes — evidence (64-in-routes-optimized.png)
[PASS] area — IN: price-book add / empty-search copy / delete — evidence (66/67/68-in-pricebook-*.png)
[PASS] area — IN: /reports links to /reports/team — evidence (72-in-reports.png)
[PASS] area — IN: /api/export?type=customers downloads CSV (200) — evidence (http-log)
[PASS] area — IN: lead created and converted to customer (Prisma: CONVERTED, customer exists) — evidence (54-in-lead-created.png, 55-in-lead-converted.png)
[PASS] area — IN: recurring plan created; dashboard lazy-generation creates exactly 1 linked job (Prisma) — evidence (61-in-recurring-created.png)
[PASS] area — IN: booking settings page renders, saves, enables page; public booking form renders and submits; created customer "Booking Bob" + NEW job — evidence (75-in-booking-settings.png, 76-in-public-booking.png)
[PASS] area — IN: duplicate price-book name rejected with inline error, modal stays open — evidence (131-pricebook-error.png)
[PASS] area — IN: review delete removes review, no silent failure — evidence (130-reviews-delete.png)
[PASS] area — IN: settings has whatsappNumber field; workingHours editor present (WorkingHoursEditor in SettingsForm) — evidence (70-in-settings.png)

## 2. Positive — CA business flow (tenant set to Canada / Quebec, CAD)
[PASS] area — CA: registration; settings switch to CA/QC/CAD — evidence (80-ca-register.png)
[PASS] area — CA: customer created; invalid phone rejected — evidence (81-ca-customer.png)
[PASS] area — CA: ON invoice computes 13% HST; BC invoice 5% GST + 7% PST — evidence (82-ca-invoice-on.png, 83-ca-invoice-bc.png)
[PASS] area — CA: QC invoice $1000 + GST 5% + QST 9.975% = $1,149.75; stored taxRate 14.975, taxAmount 149.75 — evidence (84-ca-invoice-qc-fixed.png)
[PASS] area — CA: payment form shows $ not ₹; invoices list, invoice/quote lists, line-item editor, sidebar, public invoice/quote portals all show $ — evidence (84b-ca-invoice-currency.png, 84c-ca-invoices-list.png, 160-ca-public-invoice.png, 161-ca-public-quote.png)
[PASS] area — CA: dashboard, customers, jobs, reports, price book, schedule, routes, recurring, booking pages show $ not ₹ — evidence (157-ca-dashboard.png)
[PASS] area — CA: payment form renders on invoice — evidence (150-ca-payment.png)
[PASS] area — CA: lead created via modal — evidence (152-ca-lead.png)
[PASS] area — CA: marketing page renders — evidence (153-ca-marketing.png)
[PASS] area — CA: price-book service added — evidence (154-ca-pricebook.png)
[PASS] area — CA: team / reports / dashboard pages render — evidence (155-ca-team.png, 156-ca-reports.png, 157-ca-dashboard.png)
[PASS] area — CA: public booking page enabled; renders with $ not ₹ — evidence (158-ca-booking-settings.png, 159-ca-public-booking.png)
[PASS] area — CA: public review portal /r/[businessId] renders — evidence (151-ca-review-portal.png)
[PASS] area — CA: quote created — evidence (phase3-pos-ca)

## 3. Negative / validation
[PASS] area — customer: empty name rejected server-side, stays on form with message — evidence (90-neg-empty-name.png)
[PASS] area — customer: invalid email rejected, stays on form — evidence (91-neg-bad-email.png)
[PASS] area — invoice: zero line items rejected, stays on form — evidence (92-neg-no-items.png)
[PASS] area — invoice: negative-rate line item filtered server-side — evidence (93-neg-neg-rate.png)
[PASS] area — customer: 500-char name handled, no markup break — evidence (94-neg-long-name.png)
[PASS] area — customer: emoji/HTML in name escaped (no XSS) — evidence (95-neg-xss-name.png)
[PASS] area — job: far-future date (2099-12-31) handled gracefully — evidence (96-neg-date-far-future.png)
[PASS] area — job: past date (2000-01-01) handled gracefully — evidence (96-neg-date-past.png)
[PASS] area — expired session → 307 redirect to /login — evidence (http-log)
[PASS] area — unauthenticated GET /dashboard, /customers, /invoices, /settings → login redirect — evidence (http-log)
[PASS] area — unauthenticated GET /api/export → 401; POST /api/copilot → 401 — evidence (http-log)
[PASS] area — unauthenticated GET /api/places/search → 200 by design (documented public endpoint: origin-guarded + rate-limited for the public booking page) — evidence (http-log)
[UNTESTED] area — revoked/expired token page as a standalone negative case — covered instead by SECURITY revoke/expiry lifecycle tests below

## 4. Security
[PASS] area — cross-tenant GET /customers|/jobs|/invoices|/quotes/:id (IN→CA) → 404, no data leaked — evidence (http-log)
[PASS] area — cross-tenant GET …/edit (IN→CA) → 404 — evidence (http-log)
[PASS] area — share token revoked → public portal shows invalid/revoked/expired, no data leak — evidence (100-sec-revoked.png)
[PASS] area — share token regenerate → old token replaced; OLD token invalid, NEW token serves portal — evidence (101-sec-regenerated.png)
[PASS] area — share token expiry date saved via manager; "stops working after" copy shown — evidence (102-sec-expiry.png)
[PASS] area — CSRF: forged-Origin POST /api/copilot, GET /api/export, GET /api/places/search → 403 — evidence (http-log)
[PASS] area — CSRF: same-origin and no-Origin GET /api/export → 200 — evidence (http-log)
[PASS] area — rate limit: /api/export → 429 after 20/min — evidence (http-log)
[PASS] area — rate limit: public portal → friendly rate-limited notice on 35-burst (30/min) — evidence (http-log)

## 5. Workflow / copilot
[PASS] area — copilot confirm idempotency: same key → same job, duplicate:true — evidence (http-log)
[PASS] area — copilot confirm deterministic-hash fallback: replay → duplicate:true, same job — evidence (http-log)
[PASS] area — copilot confirm invalid preview → 400, no 500 — evidence (http-log)
[PASS] area — copilot Hinglish "mere kitne customers hain?" answered from real data ("Aapke kul 12 customers hain…") — evidence (http-log)
[PASS] area — copilot gibberish → graceful clarification, nothing created — evidence (http-log)
[PASS] area — copilot out-of-scope → stays in business-assistant role — evidence (http-log)
[PASS] area — copilot create-intent asks confirmation first, does not auto-create (needsConfirm=true) — evidence (http-log)
[PASS] area — copilot confirm rate limit → 429 on 12-burst (10/min) — evidence (http-log)
[PASS] area — booking double-submit (rapid dblclick) → exactly 1 customer + 1 job, single confirmation (idempotencyKey dedupe) — evidence (140-booking-doubleclick.png)
[PASS] area — unlocatable-address job handled gracefully in route flow — evidence (http-log)
[UNTESTED] area — full lifecycle DB chain as a single scripted assertion — covered instead by the per-stage positive evidence above

## 6. Boundary / responsive
[PASS] area — schedule week spanning year boundary (Dec 2026 → Jan 2027) renders — evidence (110-bound-year.png)
[PASS] area — schedule DST-transition week (US DST 2026-11-01) renders without errors — evidence (111-bound-dst.png)
[PASS] area — invoice ₹12,34,567.89 renders in Indian format, no NaN/Infinity — evidence (112-bound-big.png)
[PASS] area — routes no-stops state has working date picker + "Go to schedule" link — evidence (113-bound-routes.png)
[PASS] area — /recurring?filter=active lists the business's active plans — evidence (114-bound-recurring-active.png)
[PASS] area — /recurring?filter=paused shows correct empty copy — evidence (114-bound-recurring-paused.png)
[PASS] area — public review portal /r/[businessId] renders — evidence (115-bound-review-portal.png)
[PASS] area — mobile 390px: public booking form renders — evidence (120-mob-booking.png)
[PASS] area — mobile 390px: job creation form renders — evidence (121-mob-jobnew.png)
[PASS] area — mobile 390px: invoice detail + totals render — evidence (122-mob-invoice.png)

---

## Bugs found and fixed during this pass
1. **Booking settings 500** — server component imported `slugify` from a `'use client'` module. Fixed via new server-safe `src/lib/slug.ts`. Retested: settings renders, saves, public booking works.
2. **Hydration mismatches** — `window.location.origin` read during initial client render in `BookingSettingsForm`, `ShareTokenManager`, `ReviewRequestsClient`. Fixed with `useEffect`-initialized origin. Dev log clean afterwards.
3. **Quebec tax precision** — `totalTaxRate` rounded 14.975 → 14.98 (invoice $1,149.80, QST shown 9.98%). Fixed in `src/lib/tax.ts` (3-decimal rate rounding) and `InvoiceForm` step=0.001. Verified: QC invoice $1,000 → GST $50 + QST $99.75 = $1,149.75, stored taxRate 14.975.
4. **CA currency leakage** — hardcoded ₹/INR across payment form, line-item editors, sidebar, lists, public portals, copilot, marketing reminders, price book, schedule, routes, recurring, booking. Fixed by threading tenant `currency` through `formatMoney`/`currencySymbol` (`src/lib/money.ts`). Verified $ everywhere on CA tenant; ₹ intact on IN tenant.
5. **Price-book duplicate names** — `createService` allowed exact duplicates. Added case-insensitive per-business duplicate check returning an inline error; modal stays open. Retested.
6. **Copilot Hinglish customer-count miss** — "mere kitne customers hain?" fell through to schedule (plural "customers" unmatched, no count intent). Added `ask_customers` intent + plural matching. Retested: "Aapke kul 12 customers hain…".

## Files changed (app repo)
- `src/lib/slug.ts` (new), `src/lib/tax.ts`, `src/lib/copilot/engine.ts`, `src/lib/money.ts` (used; pre-existing)
- `src/components/BookingSettingsForm.tsx`, `ShareTokenManager.tsx`, `ReviewRequestsClient.tsx`
- `src/components/LineItemsEditor.tsx`, `AppSidebar.tsx`, `GlobalCopilotWidget.tsx`, `RoutesClient.tsx`, `ScheduleClient.tsx`, `PriceBookClient.tsx`, `RecurringForm.tsx`, `BookingForm.tsx`
- `src/app/(app)/settings/booking/page.tsx`, `src/app/(app)/layout.tsx`
- `src/app/(app)/invoices/[id]/InvoiceActions.tsx`, `src/app/(app)/invoices/[id]/page.tsx`, `src/app/(app)/invoices/new/InvoiceForm.tsx`, `src/app/(app)/invoices/page.tsx`
- `src/app/(app)/quotes/new/QuoteForm.tsx`, `src/app/(app)/quotes/page.tsx`
- `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/customers/page.tsx`, `src/app/(app)/customers/[id]/page.tsx`
- `src/app/(app)/jobs/page.tsx`, `src/app/(app)/jobs/[id]/page.tsx`
- `src/app/(app)/reports/team/page.tsx`, `src/app/(app)/schedule/page.tsx`, `src/app/(app)/routes/page.tsx`, `src/app/(app)/pricebook/page.tsx`
- `src/app/(app)/recurring/new/page.tsx`, `src/app/(app)/recurring/[id]/edit/page.tsx`
- `src/app/actions/marketing.ts`, `src/app/actions/services.ts`
- `src/app/i/[token]/page.tsx`, `src/app/q/[token]/page.tsx`, `src/app/book/[slug]/page.tsx`
- `src/app/api/copilot/route.ts`
- No `prisma/schema.prisma` changes.

## Remaining risks / notes (not release declarations)
- Dev server died twice during the pass (runtime `/tmp` wipe + one unexplained exit); restarted. No data loss; SQLite intact.
- `/api/places/search` is intentionally public (documented in code) — origin-guarded and rate-limited, but unauthenticated by design for the public booking page.
- In-memory idempotency/rate-limit stores are single-instance (noted in code); multi-instance deploys would need shared storage.
- Quebec QST 9.975% now stored at 3-decimal precision; any downstream export/report assuming 2-decimal rates should be checked.
- Test tenants and all their records were deleted; `Sharma Home Services` verified present.
