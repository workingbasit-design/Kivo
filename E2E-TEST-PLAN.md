# EveryJob Full E2E Test Plan — 2026-09-28
Release SHA: b9e631ac (18+ removal, JobForm autocomplete, copilot year-price fix)
Target: https://kivo-nine-silk.vercel.app
Rule: local green ≠ done. A case passes only when verified live on production.

## Phase 0 — Code gates (local)
- [x] tsc clean
- [x] 711/711 unit tests (incl. copilot year-price regression, legal-fixes rewrite)
- [x] EN/FR parity inside suite
- [x] production build green
- [x] pushed to origin/main (b9e631ac)
- [ ] Vercel Ready on exactly b9e631ac

## Phase 1 — Auth
- [ ] /register shows NO 18+ checkbox; shows "By creating an account you agree to Terms of Service and Privacy Policy" with working links (EN + FR)
- [ ] Register new account succeeds without any age gate
- [ ] Register validation: bad email, short password, duplicate email → clear errors
- [ ] Login valid / invalid password → error, no crash
- [ ] Logout → lands on logged-out state; protected pages redirect to /login
- [ ] Forgot password → reset email request → reset link works → new password logs in
- [ ] Google button present on login + register
- [ ] Session survives reload + navigation (no phantom logout)

## Phase 2 — Money path
Customers:
- [ ] Create (valid, phone validation), edit, search, delete
Jobs:
- [ ] Create via form: type price 149.99 → saves 149.99; pick a date → saves that date; no phantom values
- [ ] Create via copilot chat "book AC repair for Sarah tomorrow" → price field empty (NOT 2026)
- [ ] Edit job: change price/date → persists
- [ ] Status transitions: NEW→SCHEDULED→IN_PROGRESS→COMPLETED→PAID; cancel + reopen
- [ ] Assign technician
Quotes:
- [ ] Create with line items, totals math correct, save draft
- [ ] Send, approve, decline
- [ ] Convert to job; convert to invoice
Invoices:
- [ ] Create from job, create from quote, create blank
- [ ] Send invoice
- [ ] Record cash payment (full + partial); overpayment blocked sensibly
- [ ] Overdue badge on past-due unpaid
- [ ] Booked vs collected totals agree: dashboard, Money hub, reports

## Phase 3 — Schedule & field ops
- [ ] Chat-created job appears on schedule on the correct day
- [ ] Week/day navigation, status filter chips, search
- [ ] Tracking link create → open /track/ signed out → page loads, not 500
- [ ] Timesheets: add/edit entry
- [ ] Expenses: add with amount
- [ ] Recurring: create rule → next occurrence appears

## Phase 4 — Catalogs
- [ ] Price book: add service 149 → shows $149.00; edit; delete; "use in job" prefills price
- [ ] Inventory: add item, adjust stock, low-stock indicator
- [ ] Equipment: add, assign

## Phase 5 — Growth
- [ ] Leads: create → convert to customer
- [ ] Marketing: create draft campaign, save
- [ ] Reviews: send request → open /rev/ link signed out → renders
- [ ] Reminders: quote follow-up queue visible; overdue invoice reminder; on-my-way

## Phase 6 — Public token flows (signed out, fresh tokens)
- [ ] /book/[slug]: stranger books → job + customer created
- [ ] /sign/[token]: sign flow completes
- [ ] /q, /i, /p, /portal tokens render
- [ ] Invalid/expired tokens → friendly expired page, never 500

## Phase 7 — Settings & data
- [ ] Save every settings section: profile, business, booking, notifications
- [ ] Booking headline save → public /book/ URL shown
- [ ] CSV import with preview → confirm creates records
- [ ] CSV exports: customers, jobs, quotes, invoices download

## Phase 8 — Two-business security
- [ ] Second business registers; creates customer/job/quote/invoice
- [ ] Cross-tenant: B cannot read/write A's customers, jobs, quotes, invoices, payments (UI + direct URL/API)
- [ ] Guessed IDs/tokens from A fail for B
- [ ] Dashboards show only own data

## Phase 9 — Cleanup
- [ ] Delete ALL QA records + test accounts
- [ ] Dashboard clean verification

## Honest caveats (cannot prove from here)
- True 375px iPhone visual → needs user's phone
- Real on-road GPS → needs user's phone
