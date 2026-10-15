# Small Improvements to Existing Features — Spec

**Status:** Draft — awaiting user OK before build.
**Date:** 2026-10-15
**Note:** Built alongside Tier 1 (batched, one per area, each behind the
existing feature surface — no new flags needed except where noted).

## Dashboard
- Stats calculated in the business time zone (fix server-UTC drift).
- New "Ready to invoice" card (completed jobs without invoices).
- Dismissed items stay dismissed per user (`DismissedCard`: userId,
  businessId, cardKey).

## Quotes
- Optional line items (selectable in F1 portal; stored per quote).
- Reusable templates (save quote as template; new from template).
- Photos and attachments on quotes (existing attachments infra).
- Versions v1, v2… with history (snapshot on each send).
- Expiry reminders (uses F5 scheduler; warn 3 days before expiry).

## Invoices
- Payment terms: due on receipt / net 15 / net 30 (per invoice; drives F5
  reminders and F9 aging).
- Customer statements (all open invoices, one page/PDF via F2).
- Credit notes (negative invoice linked to original; applied to balance).

## Expenses
- Tax paid fields: GST/HST, QST, PST (feeds C3 filing summary).
- Link expense to equipment.

## Customers
- Multiple service addresses (properties) per customer
  (`CustomerAddress` model; default flagged).
- Tags (existing) + lead source field.

## Leads
- Source field, response-time tracking (first response timestamp).
- Automatic acknowledgement message (uses F5 templates).

## Equipment
- Maintenance reminders (date/mileage-based; uses F5 scheduler).
- Assign equipment to jobs.

## Copilot
- Morning briefing (overnight digest: today's visits, overdue, money).
- Draft a quote from a voice note or photos using the price book (F6);
  every answer lists the records it used.
- Hard rule (tested): copilot can never act across businesses — every tool
  call carries businessId; cross-business attempt → refused + logged.

## Acceptance (per area, IDs S-001…)

Each improvement gets: unit tests for logic, E2E for the flow, fr-CA
coverage, a11y, auth-matrix update if new actions/routes. Tenant isolation
negative tests throughout.

## Build checklist (per batch)

- [ ] Migrations (idempotent); RLS staged.
- [ ] en-CA + fr-CA; parity green.
- [ ] Tests green; tsc/lint/build green.
- [ ] CI green; report with evidence; then stop.
