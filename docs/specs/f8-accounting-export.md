# F8: Accounting Export (v1) — Spec

**Status:** Draft — awaiting user OK before build.
**Date:** 2026-10-15
**Tier:** 1 (build after F7)

## Goal

Version 1: exports shaped for import into QuickBooks Online, Xero, and Wave
(customers, invoices, payments, tax amounts by type). Version 2 (separate
session): QuickBooks Online sync with mapping screen, error log, retry —
never silently overwriting either system.

## Current state

CSV export exists (F1–F4 flows); `src/lib/quickbooks.ts` exists (partial).
F8 v1 adds properly-shaped exports; v2 is explicitly a later session.

## Personas & user stories

### Owner / Admin
- As an owner, I pick "Export for QuickBooks" and get files my accountant
  can import: customers, invoices (with tax lines), payments.
- As an owner, I pick a date range; tax amounts are broken out by type
  (GST/HST, PST, QST).
- As an owner, each export includes a reconciliation summary (counts,
  totals) so I can verify nothing was lost.

## Export formats (v1)

| Target | Format |
|---|---|
| QuickBooks Online | CSV (3-file: customers, invoices, payments) per QBO import spec |
| Xero | CSV per Xero import template |
| Wave | CSV per Wave import template |

Each format documented with the target's current template (link in build
report; re-verified at build time).

## Data model

No new tables. Export is computed on demand from existing rows. Add
`ExportLog`: id, businessId, kind, format, rangeFrom/To, rowCounts Json,
createdById, createdAt (audit trail).

## Permissions

| Action | Owner/Admin | Others |
|---|---|---|
| Run accounting export | ✅ | ❌ |

## Tenant isolation

Exports scope every query by businessId. Negative test: Business B's export
contains zero of Business A's rows.

## Edge cases

1. Void invoices excluded (or marked void per target spec).
2. Partially-paid invoices export balance + payment records.
3. Tax by type uses `calcTax` + F6 tax categories (feeds C3).
4. Large exports (>10k rows) stream; no memory blowup.
5. French business → French column headers option.

## Out of scope (v2, separate session)

QuickBooks Online API sync (OAuth, mapping screen, error log, retry,
conflict handling). V1 is files only.

## Acceptance tests

| ID | Test |
|---|---|
| F8-001 | Unit: QBO/Xero/Wave row shaping (headers, tax columns). |
| F8-002 | Unit: reconciliation totals match DB aggregates. |
| F8-003 | DB: cross-business isolation. |
| F8-004 | E2E (owner): export QBO → files download, spot-check totals. |
| F8-005 | E2E (owner): date-range filter respected. |
| F8-006 | A11y: axe on export page. |
| F8-007 | Auth matrix: new actions added. |

## Build checklist

- [ ] Target import specs re-verified (links in report).
- [ ] Feature flag `accountingExport`.
- [ ] en-CA + fr-CA; parity green.
- [ ] Tests F8-001…007 green; tsc/lint/build green.
- [ ] CI green; report with evidence; then stop.
