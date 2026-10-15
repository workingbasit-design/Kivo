# F3: Recurring Work — Spec

**Status:** Draft — awaiting user OK before build.
**Date:** 2026-10-15
**Tier:** 1 (build after F2)

## Goal

Jobs with multiple visits: repeat rules, per-visit editing, seasonal
contracts, and correct billing. Visits appear on the schedule and in "Ready
to invoice".

## Current state

`RecurringJob` model exists (WEEKLY/BIWEEKLY/MONTHLY, `nextRun`, generates
`Job[]`). UI at `src/app/(app)/recurring/`. F3 expands it to the full
requirement below; existing behavior must not regress.

## Personas & user stories

### Owner / Admin
- As an owner, I create a recurring job: customer, service, repeat rule
  (weekly / every 2 weeks / monthly on a set day / custom interval), start
  date, end date or number of visits.
- As an owner, I edit one visit (time, technician, notes) without touching
  the others, or "apply to all future visits".
- As an owner, I skip a visit (it stays visible as skipped, not deleted).
- As an owner, I get warned when a visit falls on a statutory holiday
  (Canada, province-aware).
- As an owner, I choose billing: per visit, monthly batch, or fixed contract
  price. For seasonal contracts (snow/lawn): per-visit or flat seasonal price.
- As an owner, visits show on the schedule; completed visits appear in
  "Ready to invoice" (per the billing choice).

### Dispatcher
- As a dispatcher, I assign technicians per visit and see conflicts.

### Technician
- As a technician, my "My day" shows recurring visits like any other job
  (F4).

### Customer
- As a customer, I see my upcoming visits in the portal (F1).

## Repeat rules

| Rule | Definition |
|---|---|
| Weekly | Every 7 days on the same weekday |
| Every 2 weeks | Every 14 days |
| Monthly (day) | Same calendar day each month (e.g., the 15th); months without that day use the last day |
| Custom | Every N days/weeks, chosen by owner |
| End | Date or visit count; none = open-ended (owner confirms yearly) |

Generation: visits materialize as `Job` rows 90 days ahead (rolling); a
daily cron extends the horizon. Editing "all future" updates the rule and
regenerates unstarted visits only.

## Data model (migration M16)

Extend `RecurringJob`:
- `rule String` — JSON: `{ kind: 'WEEKLY'|'BIWEEKLY'|'MONTHLY_DAY'|'CUSTOM', intervalDays?: number, dayOfMonth?: number }` (replaces `frequency`).
- `endDate DateTime?`, `visitCount Int?`
- `billingMode String` — `PER_VISIT | MONTHLY_BATCH | CONTRACT_FLAT` (+ `SEASONAL_PER_VISIT | SEASONAL_FLAT`).
- `contractPriceCents BigInt?` (for flat modes)
- `seasonStart DateTime?`, `seasonEnd DateTime?` (seasonal)

`Job` additions:
- `recurringJobId String?` (exists via relation), `visitDate DateTime`,
  `visitStatus String` — `SCHEDULED | SKIPPED | DONE` (separate from job
  lifecycle status), `isException Boolean @default(false)` (edited
  individually — excluded from "apply to all future").

Statutory holidays: existing `ca-holidays` lib; warning computed at
generation time and shown on the visit.

## Permissions

| Action | Owner/Admin | Dispatcher | Technician |
|---|---|---|---|
| Create/edit recurring plan | ✅ | ❌ | ❌ |
| Edit one visit | ✅ | ✅ | ❌ |
| Skip visit | ✅ | ✅ | ❌ |
| View visits | ✅ | ✅ | ✅ (own only) |

## Tenant isolation

`RecurringJob.businessId` required; all visit generation runs inside the
business scope. Negative test: Business B cannot list/edit Business A's
plans or visits.

## Edge cases

1. DST transitions: visit times are wall-clock in business timezone.
2. Month without the 29th/30th/31st → last day of month, flagged.
3. Skipped visit in a CONTRACT_FLAT plan → price unchanged (contract is
   flat); in PER_VISIT → no charge.
4. "Apply to all future" never touches started/completed visits or
   exceptions.
5. Deleting a plan → future unstarted visits cancelled; past visits kept.
6. Holiday warning is a warning, not a block (some work happens on
   holidays).
7. Monthly batch billing: visits grouped by calendar month; one invoice per
   month per customer (draft, owner reviews).

## Out of scope

- Weather-triggered visits (C9).
- Customer self-service rescheduling (portal shows; changes go through the
  business).
- Prorated mid-season contract changes (v1: owner adjusts manually).

## Acceptance tests

| ID | Test |
|---|---|
| F3-001 | Unit: rule expansion (weekly/biweekly/monthly-day/custom) incl. short months. |
| F3-002 | Unit: holiday warning fires for province holidays. |
| F3-003 | Unit: billing totals per mode (per-visit, monthly batch, flat, seasonal). |
| F3-004 | DB: visits generate 90 days out; cron extends horizon. |
| F3-005 | DB: Business B cannot touch Business A's plans/visits. |
| F3-006 | E2E (owner): create weekly plan → visits on schedule → edit one visit → others unchanged. |
| F3-007 | E2E (owner): "apply to all future" → future visits update, past/exceptions untouched. |
| F3-008 | E2E (owner): skip visit → shows skipped; per-visit billing excludes it. |
| F3-009 | E2E (owner): monthly batch → one draft invoice per month. |
| F3-010 | E2E (fr-CA): plan creation + visit list in French. |
| F3-011 | A11y: axe on recurring pages, zero serious/critical. |
| F3-012 | Auth matrix: new actions added. |

## Build checklist

- [ ] Migration M16 (idempotent); RLS staged.
- [ ] Server validation (zod); feature flag `recurringV2`.
- [ ] en-CA + fr-CA; parity green.
- [ ] Loading/empty/error states.
- [ ] Tests F3-001…012 green; tsc/lint/build green.
- [ ] CI green; report with evidence; then stop.
