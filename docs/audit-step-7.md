# Audit Step 7: Gap check against a Jobber-class app

Read-only audit. All findings verified against code at ~/workspace/kivo (HEAD 5898475, 2026-10-13).

## 1. Recurring jobs and visits — PRESENT

- Server actions: `src/app/actions/recurring.ts` (createRecurring, updateRecurring, deleteRecurring, generateDueJobs)
- UI: `src/app/(app)/recurring/` with `page.tsx`, `RecurringClient.tsx`, `RecurringRowActions.tsx`, `GenerateDueJobsButton.tsx`, `new/` and `[id]/` routes
- Model: `RecurringJob` in `prisma/schema.prisma` (title, frequency, nextRun, price/priceCents, customerId, businessId)
- Due-job generation via `generateDueJobs` in `src/lib/recurring.ts`
- Note: recurring visits generate jobs; no separate "visit" entity distinct from jobs.

## 2. Client portal — PRESENT (partial)

- Magic-link customer portal: `src/app/portal/[token]/page.tsx` — public, token-scoped to one (businessId, customerId); shows customer's jobs, quotes, invoices. No login required.
- Authenticated customer app: `src/app/customer/` (login, home, requests, messages, profile, saved, concierge)
- Quote approval: PRESENT via public share link `src/app/q/[token]/page.tsx` — has approveLabel / portal.approved states (`quotes.portal.approveLabel`); customers approve without an account.
- E-sign: PRESENT — `SignatureRequest` model (`prisma/schema.prisma:447`); public signing at `src/app/sign/[token]/SignClient.tsx` (canvas draw or typed name); business-side prepare UI at `src/app/(app)/quotes/[id]/sign/`.
- Pay online: PRESENT — `src/app/api/pay/invoice/route.ts` and `src/app/api/pay/quote-deposit/route.ts`; Stripe Connect via `src/app/api/stripe/connect/route.ts`, `callback`, `webhook`; `StripeConnection` model (`prisma/schema.prisma:864`).
- Gap: the token portal (`/portal/[token]`) is read-only for quotes (lists them, no approve button found there); approval happens via the separate `/q/[token]` link.

## 3. PDF quotes and invoices — MISSING

- No PDF library in dependencies: grep for `pdfkit`, `puppeteer`, `react-pdf`, `jspdf`, `pdf-lib` in `src/` and `package.json` returns nothing.
- No `*pdf*` file in `src/lib/`.
- There is a print view: `src/app/(app)/quotes/[id]/sign/[requestId]/print/page.tsx` (browser print, not PDF generation).

## 4. Job assignment and roles — PRESENT (partial)

- Job assignment fields on `Job` model (`prisma/schema.prisma:201-203,227-228`): `technician String?` (free text), `assignedToId` → `User` relation ("JobAssignedTo"), `crewId` → `Crew` relation (onDelete SetNull).
- `Crew` model exists with `businessId` (tenant-guarded).
- Roles: `User.role` defaults to `"ADMIN"` (`prisma/schema.prisma:15`); `"MEMBER"` used in team report (`src/app/(app)/reports/team/page.tsx`); admin-gated pages check `user.role === 'ADMIN'` (e.g. `src/app/(app)/settings/team/page.tsx:17`, `src/app/(app)/jobs/[id]/page.tsx:108`).
- Team management UI: `src/app/(app)/settings/team/page.tsx`; member actions in `src/app/actions/settings.ts`.
- Gap: only two roles (ADMIN/MEMBER); no granular permissions (e.g. dispatcher vs technician).

## 5. Automated reminders and "on my way" texts — MISSING (by design)

- `src/lib/reminders.ts` header states the hard rule: "EveryJob NEVER sends a message automatically. These helpers only build draft text and deep links (wa.me / sms: / mailto:) that the business owner taps and sends from their own apps."
- `src/lib/sms.ts` header: no genuine free server-side SMS API for Canada; only builds native `sms:` deep links. EveryJob spends $0 and sends nothing automatically.
- Reminder queue helpers exist (`src/lib/reminders.ts`) and a messaging cron exists (`src/app/api/cron/messaging/route.ts`), but delivery is manual tap-to-send.
- Live GPS tracking share: PRESENT — `/track/[token]` with `LiveTrackingClient`, `TechnicianLocation` model; "on my way" strings exist in i18n fragments (`src/lib/i18n/fragments/gps.ts`), but no automatic "on my way" SMS is sent.

## 6. Online booking — PRESENT

- Public booking page: `src/app/book/[slug]/page.tsx` with `BookingForm` component, working-hours summary, business slug routing. No login required.

## 7. Price book — PRESENT

- `src/app/(app)/pricebook/page.tsx`; services managed via `src/app/actions/services.ts` (create/update, `price`/`priceCents` dual-write).

## 8. Accounting export — PRESENT (partial)

- CSV export: `src/lib/csv.ts` exists (with formula-injection neutralization per `src/lib/costing.ts`).
- QuickBooks: `src/lib/quickbooks.ts` exists; `QuickBooksConnection` and `QuickBooksSyncLog` models in schema.
- Gap vs Jobber: no full double-entry accounting suite; export + sync helpers only.

## 9. Reports — PRESENT

- `src/app/(app)/reports/page.tsx` — natural-language report builder ("Add jobs, send invoices and record payments - your reports will build themselves here"), saved reports, team reports at `src/app/(app)/reports/team/`.
- `SavedReport` model in schema (tenant-guarded).

## 10. Audit log — PARTIAL

- `PiaAuditLog` model (`prisma/schema.prisma:1199`) records privacy-relevant actions: `action` ("view" | "export" | "search"), `entityType`, `entityId`, `metadata` JSON, indexed by (businessId, createdAt) and (userId, createdAt).
- Gap: no general CRUD audit log (who changed what field, before/after values). PIA log covers views/exports/searches only.

## 11. Archive and void instead of delete — MISSING

- No `deletedAt` column anywhere in `prisma/schema.prisma` (grep count: 0). All deletes are hard deletes.
- Customer delete: `src/app/actions/customers.ts:200` uses `prisma.customer.delete` (hard). Delete is blocked when linked records exist (launch-pack fix), but there is no archive/soft-delete.
- Invoice delete: blocked when paid or has payments; no void-with-reason flow exists (no "void" in `src/app/actions/invoices.ts`).
- Quote delete: drafts/sent/declined only; approved quotes are kept as records.

## 12. Invoice numbering — PRESENT

- `nextInvoiceNumber(businessId)` in `src/app/actions/invoices.ts:84-99`: `INV-0001` style, scoped per business, retry-safe (regex `^INV-(\d+)$`, zero-padded to 4, increments on collision retry).

## 13. Time zone handling — PRESENT (partial)

- `Business.timezone` field: IANA string, nullable, e.g. "America/Toronto" (`prisma/schema.prisma:66`); null = region default.
- Job storage: `Job.date` is `DateTime` (calendar day), `Job.time` is `String?` ("HH:MM" normalized via `normalizeJobTime`).
- Display helpers in `src/lib/utils.ts`: `toISODateInTimezone`, `todayInTimezone` — schedule uses business timezone for day boundaries.
- Money storage: `Float` dollars (legacy) + `BigInt` `*Cents` columns (migration in progress, dual-write active); e.g. `Job.price Float` + `Job.priceCents BigInt?`.
- Gap: times stored as plain text strings, not timestamptz; DST edge cases handled at display layer only.

## 14. French completeness — COMPLETE (0 missing)

- i18n lives in `src/lib/i18n/`: `en.ts`, `fr.ts`, plus 41 fragment files in `src/lib/i18n/fragments/` (~6,062 keys total).
- `t('...')` call sites in `src/app`: 153.
- Parity test `src/lib/__tests__/i18n-parity.test.mts` passes: "fr dictionary has every en key" and "en dictionary has every fr key (no orphans)". **0 untranslated strings.**

## Summary table

| # | Capability | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Recurring jobs | Present | `src/app/actions/recurring.ts`, `src/app/(app)/recurring/` |
| 2 | Client portal / approve / e-sign / pay | Present (portal read-only for quotes) | `src/app/portal/[token]`, `src/app/q/[token]` (approve), `src/app/sign/[token]` (e-sign), `src/app/api/pay/*` (Stripe) |
| 3 | PDF quotes/invoices | Missing | No PDF lib in package.json or src/ |
| 4 | Job assignment and roles | Present (ADMIN/MEMBER only) | `Job.assignedToId/crewId/technician`, `src/app/(app)/settings/team/` |
| 5 | Automated reminders / on-my-way | Missing (by design, $0 rule) | `src/lib/reminders.ts` header; tracking share at `/track/[token]` exists |
| 6 | Online booking | Present | `src/app/book/[slug]` + BookingForm |
| 7 | Price book | Present | `src/app/(app)/pricebook/`, `src/app/actions/services.ts` |
| 8 | Accounting export | Present (partial) | `src/lib/csv.ts`, `src/lib/quickbooks.ts` |
| 9 | Reports | Present | `src/app/(app)/reports/` + builder, `SavedReport` model |
| 10 | Audit log | Partial (PIA only) | `PiaAuditLog` model; no CRUD audit |
| 11 | Archive/void vs delete | Missing | 0 `deletedAt` columns; hard deletes |
| 12 | Invoice numbering | Present | `INV-0001` per business, retry-safe |
| 13 | Time zone handling | Present (partial) | `Business.timezone`, `todayInTimezone`; times stored as text |
| 14 | French completeness | Complete | i18n-parity test green, 0 missing |
