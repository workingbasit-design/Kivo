# F9: Reports — Spec

**Status:** Draft — awaiting user OK before build.
**Date:** 2026-10-15
**Tier:** 1 (build after F8)

## Goal

Revenue invoiced vs collected by month; AR aging (current, 1–30, 31–60,
61–90, 90+ days); job profitability; sales tax collected by type and filing
period; expenses by category with tax paid; lead sources and conversion.
Every number links to the records behind it. CSV export.

## Current state

Report builder exists at `src/app/(app)/reports/` (partial). F9 completes
the six required reports with drill-down.

## Reports

1. **Revenue:** invoiced vs collected by month (bar + table).
2. **AR aging:** buckets current / 1–30 / 31–60 / 61–90 / 90+ days.
3. **Job profitability:** revenue − labor/materials per job (uses F6 costs
   when set).
4. **Sales tax:** collected by type (GST/HST, PST, QST) per filing period
   (feeds C3).
5. **Expenses:** by category with tax paid.
6. **Leads:** sources and conversion rate (lead → customer).

Every figure is a link to the underlying filtered list. CSV export per
report.

## Data model

No new tables (computed from existing rows). Add `ReportCache`: id,
businessId, key, params Json, result Json, computedAt — 15-min cache for
heavy aggregates, invalidated on relevant writes.

## Permissions

| Action | Owner/Admin | Dispatcher | Technician |
|---|---|---|---|
| View reports | ✅ | ❌ | ❌ |

## Tenant isolation

All aggregates filter by businessId first. Negative test: Business B's
reports show zero of Business A's numbers.

## Edge cases

1. Timezone: months/buckets computed in business timezone.
2. Void invoices excluded from revenue; shown separately.
3. Partial payments attributed to the invoice's month (collected) vs
   invoice month (invoiced).
4. Empty states per report ("No invoices yet").

## Out of scope

- Custom report builder UI (v1: the six reports).
- PDF of reports (CSV only; F2 covers document PDFs).

## Acceptance tests

| ID | Test |
|---|---|
| F9-001 | Unit: aging buckets (boundary days). |
| F9-002 | Unit: revenue invoiced vs collected (partial payments). |
| F9-003 | Unit: tax by type and period. |
| F9-004 | DB: cross-business isolation. |
| F9-005 | E2E (owner): each report loads, numbers link to records. |
| F9-006 | E2E (owner): CSV export matches screen. |
| F9-007 | E2E (technician): reports return 403. |
| F9-008 | E2E (fr-CA): reports in French. |
| F9-009 | A11y: axe, zero serious/critical. |
| F9-010 | Auth matrix: new actions added. |

## Build checklist

- [ ] Feature flag `reportsV2`.
- [ ] en-CA + fr-CA; parity green.
- [ ] Tests F9-001…010 green; tsc/lint/build green.
- [ ] CI green; report with evidence; then stop.
