# Part A: Make the Data Correct — Plan

**Goal:** Fix data integrity, status logic, timezone handling, and destructive flows. All changes verified by tests before moving to Part B.

**Prerequisite notes:**
- The 8 audit questions are unanswered. Assumptions made below are marked [ASSUMPTION] for your correction.
- Money migration (P0-2): Dual-write is active. Historical backfill and read-switching are pending your answers to Q1/Q2. Part A does not depend on them.
- Vercel deploy is stalled (P1-3). Live verification of these changes will wait until you clear the dashboard.

---

## A1. One Job Lifecycle

**Current state:**
- Job statuses: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED (plus derived LATE)
- Status labels scattered across files; `jobDisplayStatus()` in `src/lib/utils.ts:283` returns 'LATE'
- Filter orders differ between Jobs and Schedule pages
- "Invoiced" is not tracked separately from COMPLETED

**Changes:**

1. **Create `src/lib/job-status.ts`** (new file):
   - Export `JOB_STATUSES` const: `['NEW', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']`
   - Export `jobStatusLabel(status, locale)` using i18n keys: New, Scheduled, In progress, Completed, Cancelled (sentence case, not all-caps)
   - Export `isJobLate(job, now, timezone)`: returns true when `job.date` < today (in business timezone) AND status in `['NEW', 'SCHEDULED']`
   - Export `isJobInvoiced(jobId)`: checks for linked invoice via `InvoiceLineItem` or `Job.invoiceId`

2. **Database:** Add `Job.invoicedAt DateTime?` (nullable). Set when first invoice links to the job. Migration is additive, no data loss.
   - [ASSUMPTION]: "Invoiced" means at least one non-voided invoice exists for the job.

3. **Update `src/lib/utils.ts`:**
   - Deprecate `jobDisplayStatus()` — replace calls with new `getJobDisplay()` that returns `{ status, isLate, isInvoiced }`
   - Fix `isJobOverdue()` to accept a timezone parameter (currently uses server UTC — bug from audit P1-1)

4. **Create `src/components/StatusBadge.tsx`** (new shared component):
   - Props: `status`, `isLate`, `locale`
   - Renders status pill + separate "Late" badge (not all-caps, sentence case)
   - Replaces one-off badges in: Jobs list, Schedule, Job detail, Dashboard

5. **Fix filter order:** Both Jobs (`src/app/(app)/jobs/page.tsx`) and Schedule (`src/app/(app)/schedule/ScheduleClient.tsx`) import `JOB_STATUSES` from the new file. Delete the local `STATUS_TABS` const in ScheduleClient.

**Tests:**
- `src/lib/__tests__/job-lifecycle.test.mts` (new):
  - Late logic in America/Toronto, America/Regina, America/St_Johns
  - DST boundary: Sunday Nov 1, 2026 (clocks fall back)
  - Evening edge: 9 PM Toronto on Oct 13 = Oct 14 01:00 UTC — job dated Oct 13 should NOT be Late at 9 PM Toronto
  - `isJobLate` returns false for COMPLETED, CANCELLED, IN_PROGRESS
  - `isJobLate` returns false for future dates

---

## A2. Date and Time Storage

**Current state:**
- `Job.date`: DateTime (date only, time set to midnight)
- `Job.time`: String ("10:00" or "10:00 AM" — mixed formats in DB)
- No `businesses.timezone` column; `todayInTimezone` uses a default

**Changes:**

1. **Database migration** (additive):
   - Add `Business.timezone String @default("America/Toronto")`
   - Add `Job.startAt DateTime?` (timestamptz)
   - Add `Job.endAt DateTime?` (nullable)
   - Add `Job.timeTbd Boolean @default(false)`
   - Keep `Job.date` and `Job.time` during transition (remove in later migration after verification)

2. **Backfill script** (`scripts/backfill-startat.ts`, fake-data safe):
   - For each job with `date` + `time`: parse time (handle both "09:00" and "10:00 AM" formats), combine with date in business timezone, write to `startAt`
   - List unparseable rows to console (do not guess)
   - Run on local/staging first; production only with your explicit approval

3. **Update `src/lib/timezone.ts`** (or create):
   - Export `formatDateTime(date, timezone, locale)` using `Intl.DateTimeFormat`
   - Export `formatTime(date, timezone, locale)` — single canonical format
   - All display goes through these; no raw `job.time` rendering

4. **Settings UI:** Add timezone picker in `src/app/(app)/settings/` (IANA list, default America/Toronto).

5. **Update writes:** `src/app/actions/jobs.ts` `createJob`/`updateJob` — parse time input, write to `startAt` (and legacy `date`/`time` during transition).

**Tests:**
- Time parsing: "09:00" → 09:00, "10:00 AM" → 10:00, "2:30 PM" → 14:30, invalid → null (listed, not guessed)
- Timezone conversion: 10:00 AM Toronto displayed correctly in en-CA and fr-CA

---

## A3. One Source of Truth for Counts

**Current state (audit P1-1):**
- Jobs page: no date filter, shows all
- Schedule: date-bounded to visible week, "All scheduled dates (N)" counts only current week
- Money: "outstanding" = SENT quotes + unpaid invoices + COMPLETED-without-invoice

**Changes:**

1. **Create `src/lib/job-queries.ts`** (new file):
   - `getJobsInRange(businessId, startDate, endDate, timezone)` — all jobs with startAt in range, including Late ones
   - `getJobCounts(businessId)` — returns `{ total, scheduled, late, completed, uninvoiced }`
   - `getMoneySummary(businessId)` — returns `{ outstanding, readyToInvoice, openQuotes }`
   - All four screens (Dashboard, Jobs, Schedule, Money) import from here

2. **Schedule fix:** "All scheduled dates (N)" — N = count of jobs with a date (not just current week). Or relabel to "This week's dates (N)" if we keep week-scoped.

3. **Money fix:** Add "Ready to invoice" section (see A4).

**Tests:**
- `src/lib/__tests__/job-queries.test.mts` (new integration test):
  - Seed 4 jobs: past (Oct 10), today (Oct 13), future (Oct 20), no date (null)
  - Assert Dashboard, Jobs, Schedule, Money all return consistent counts
  - Assert Schedule shows past job as Late, today highlighted, future normal, no-date excluded from date views but counted in total

---

## A4. The Money Page Tells the Truth

**Current state:** Money shows "outstanding" but scheduled-but-uninvoiced work is invisible. Three separate "nothing here" empty states.

**Changes:**

1. **Add "Ready to invoice" section** to `src/app/(app)/money/page.tsx`:
   - Query: `COMPLETED` jobs with no linked invoice (`invoicedAt` is null)
   - Show total amount ready to invoice
   - Each row: job title, customer, amount, "Create invoice" button

2. **"All caught up" logic:** Show only when ALL true:
   - No open quotes (DRAFT or SENT)
   - No unpaid invoices (UNPAID or PARTIALLY_PAID)
   - Nothing ready to invoice (no uninvoiced COMPLETED jobs)

3. **Move Late jobs:** Remove Late jobs from Money; they belong in Dashboard attention list (add if not present).

4. **Single empty state:** Replace three "nothing here" messages with one `EmptyState` component (see B8) with one clear next action.

**Tests:**
- Money summary returns correct `readyToInvoice` total
- "All caught up" shows only when all three conditions met
- "All caught up" hidden when any condition fails

---

## A5. Zero-Price Jobs

**Current state:** Schema allows $0 (`min(0)`). `1188a77` added a warning in JobForm but no "No charge" explicit opt-in.

**Changes:**

1. **Database:** Add `Job.noCharge Boolean @default(false)`

2. **JobForm** (`src/components/JobForm.tsx` or equivalent):
   - When price is $0 and `noCharge` is false: show warning "No price set — is this a no-charge job?"
   - Add checkbox: "No charge (warranty callback, goodwill, etc.)"
   - If checked: set `noCharge=true`, allow $0 silently
   - If not checked and price is $0: block save with message "Enter a price or tick 'No charge'"

3. **Invoice guard:** When creating invoice from a $0 job without `noCharge`, show confirm dialog: "This job has no price set. Create a $0 invoice?"

4. **Display:** Jobs with `noCharge=true` show "No charge" badge instead of "$0.00".

**Tests:**
- $0 with `noCharge=true` saves silently
- $0 with `noCharge=false` blocked with warning
- Invoice from $0 job shows confirm dialog

---

## A6. Today and Week Navigation

**Current state:** Today highlight fixed in code (needs live verify). "This week" button behavior unclear.

**Changes:**

1. **Today highlight:** Use business timezone (not server UTC) to determine "today". Already fixed in code (`border-lime-500 bg-lime-50`); verify it uses `todayInTimezone(business.timezone)`.

2. **"This week" button:** Disabled state when already viewing the current week. Add `disabled` prop with visual dimming.

3. **Week strip:** Ensure `todayInTimezone` is passed the business timezone, not a hardcoded value.

**Tests:**
- Today highlight appears on correct day in America/Toronto, America/Regina, America/St_Johns
- "This week" disabled when on current week, enabled when on other weeks

---

## A7. Never Destroy Financial Records

**Current state (audit):**
- Customer delete: **blocked** when jobs/invoices/quotes exist (good)
- Invoice delete: blocked when PAID or any payment exists (good), but error says "Void it instead" and **no void flow exists**
- No `deletedAt` columns anywhere; all hard deletes
- Foreign keys: need to verify ON DELETE behavior

**Changes:**

1. **Customer archive:**
   - Add `Customer.archivedAt DateTime?`
   - `archiveCustomer` action: sets `archivedAt`, hides from lists, restorable via `unarchiveCustomer`
   - `deleteCustomer`: only allowed when `archivedAt` is set AND zero linked jobs/quotes/invoices/payments. Otherwise blocked with message.
   - Update all customer list queries to filter `archivedAt: null`

2. **Invoice void:**
   - Add `Invoice.voidedAt DateTime?`
   - Add `Invoice.voidReason String?`
   - `voidInvoice` action: requires reason (min 10 chars), sets `voidedAt`, keeps number, excludes from reports
   - Only DRAFT invoices can be deleted. SENT/PARTIALLY_PAID/PAID can only be voided.
   - [ASSUMPTION]: Voided invoices keep their number (no reuse). Totals excluded from revenue reports.

3. **Payment void:**
   - Add `Payment.voidedAt DateTime?`
   - Add `Payment.voidReason String?`
   - `voidPayment` action: requires reason, sets `voidedAt`
   - Payments never deleted.

4. **Credit notes:**
   - Add `CreditNote` model: `id`, `businessId`, `invoiceId`, `amountCents`, `reason`, `createdAt`
   - `createCreditNote` action for post-send corrections
   - [ASSUMPTION]: Credit notes are the correction mechanism (not editing sent invoices).

5. **Foreign keys:** Audit all FKs from Invoice, InvoiceLineItem, Payment, TaxLine. Change any `onDelete: Cascade` to `onDelete: Restrict`. List changes in migration notes.

6. **Confirm dialogs:** Every destructive action uses the shared `ConfirmDialog` (see B8) with plain-words description: "This will archive [customer]. Their jobs and invoices stay in the system. You can restore them later."

**Tests:**
- Archive customer with jobs: succeeds, hidden from list, restorable
- Delete customer with jobs: blocked with clear message
- Delete customer with nothing: succeeds
- Void invoice with reason: succeeds, number kept, excluded from reports
- Void invoice without reason: blocked
- Delete SENT invoice: blocked
- Void payment with reason: succeeds
- FK restrict: attempt to delete business with invoices fails at DB level

---

## A8. Generic Auth Messages

**Status:** Already done. Verified in audit Step 6:
- Business login: "Incorrect email or password." (src/lib/auth.ts:133)
- Customer login: "Invalid email or password." (src/lib/customer-auth.ts:90)
- Password reset: Always says "If an account exists for that email, we sent a link." (verify this message exists)

**Changes:** None needed. Verify password reset message in code.

---

## Test Summary

**New test files:**
1. `src/lib/__tests__/job-lifecycle.test.mts` — Late logic, timezones, DST
2. `src/lib/__tests__/job-queries.test.mts` — A3 integration test (4 jobs, 4 screens agree)
3. `src/lib/__tests__/financial-safety.test.mts` — A7 archive/void/blocked deletes

**Updated tests:** Existing job-overdue tests (already updated for LATE terminology).

**Run:** `npm test` must show 1029+ passing (new tests added). `npx tsc --noEmit` clean. `npm run lint` 0 errors.

---

## Migration Summary

**Prisma migrations (all additive, reversible):**
1. `add_job_lifecycle_fields`: `Job.invoicedAt`, `Job.noCharge`, `Job.startAt`, `Job.endAt`, `Job.timeTbd`
2. `add_business_timezone`: `Business.timezone` (default "America/Toronto")
3. `add_archive_void_fields`: `Customer.archivedAt`, `Invoice.voidedAt`, `Invoice.voidReason`, `Payment.voidedAt`, `Payment.voidReason`
4. `add_credit_note_model`: New `CreditNote` table
5. `restrict_financial_fks`: Change ON DELETE CASCADE → RESTRICT on financial tables

**Rollback:** Each migration has a corresponding down migration. Backup recommended before production run.

---

## Open Questions (from audit, blocking some items)

- Q1/Q2 (backfill/read-switch timing): Does not block Part A.
- Q7 (void flow): **Assumed** — build void-with-reason. Correct me if you want a different approach.
- Vercel deploy: Live verification of A1-A6 UI changes waits until you clear the dashboard.

---

**Next:** Awaiting your OK on this plan before implementation begins.
