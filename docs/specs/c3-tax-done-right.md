# C3: Tax Done Right — Spec

**Status:** Draft — awaiting user OK before build.
**Date:** 2026-10-15
**Tier:** 2 (pick 3 of 3)

## Goal

Tax rate chosen by the province of the service address (place of supply).
Per-line tax category from the price book (F6). Business can override a rate
on a document with a reason (logged). PST exemptions per province,
configurable, defaults marked for accountant review. Small supplier mode.
GST/HST and QST numbers on documents. Sales tax summary per filing period:
collected by type, tax paid on expenses (ITCs / Quebec ITRs), net. Expenses
record tax paid; receipt photo suggests amounts (owner confirms). Labelled
as a bookkeeping helper — not tax advice, not a filing service.

## Personas & user stories

### Owner
- As an owner, I enter a service address in BC; the quote shows GST 5% +
  PST 7% automatically (place of supply).
- As an owner, I override the rate on one invoice with a reason; the
  override is logged and shown on the document.
- As an owner, I open the tax summary for Q3: GST collected, PST collected,
  QST collected, ITCs from expenses, net owing — then give it to my
  accountant.
- As an owner, I photograph a receipt; the app suggests the tax amounts; I
  confirm.

## Screens (390px ASCII)

### Tax collected (per period)

```
+--------------------------------------+
|  < Sales tax              Q3 2026   |
|                                      |
|  Collected on invoices               |
|  GST/HST               $1,842.10   |
|  QST                     $412.55   |
|  PST (BC)                 $96.00   |
|                                      |
|  Paid on expenses                    |
|  GST/HST                 $310.40   |
|  QST                      $68.10   |
|                                      |
|  Net owing               $1,972.15   |
|                                      |
|  [ Export for filing (CSV) ]         |
+--------------------------------------+
```

## Place of supply

Rate source: province/territory of the **service address** (not the
business address, not the billing address). Table (re-verified at build):

| Province | GST/HST | PST/QST |
|---|---|---|
| ON | 13% HST | — |
| QC | 5% GST | 9.975% QST (on price ex-GST) |
| BC | 5% GST | 7% PST |
| AB/NT/NU/YT | 5% GST | — |
| SK | 5% GST | 6% PST |
| MB | 5% GST | 7% RST |
| NB/NL/NS/PE | 15% HST | — |

**QST 9.975% applies to the price EXCLUDING GST (since 2013-01-01) — never
"fix" this.** Small supplier mode: under $30k → no tax charged (flag per
business, owner attests).

## Data model (migration M24)

- `Business`: add `smallSupplier Boolean @default(false)`,
  `pstExemptions Json?` (per-province overrides).
- `Quote`/`Invoice`: add `taxProvince String?`, `taxOverrideReason String?`,
  `taxOverrideById?`.
- `Expense`: add `gstHstPaidCents BigInt?`, `pstPaidCents BigInt?`,
  `qstPaidCents BigInt?`, `receiptUrl?`, `receiptParsed Json?`.
- `TaxFiling`: id, businessId, periodStart/End, type, collected Json,
  paid Json, net Json, status (DRAFT/FINALIZED), finalizedAt.

## Permissions

| Action | Owner/Admin | Others |
|---|---|---|
| Override tax rate | ✅ | ❌ |
| Finalize filing summary | ✅ | ❌ |
| View tax summary | ✅ | ❌ |

## Tenant isolation

All tax data scoped by businessId. Negative test: Business B cannot see
Business A's filings.

## Edge cases

1. Service address missing → fall back to business province + warning.
2. Override reason required (min 10 chars), logged, shown on PDF (F2).
3. Filing finalized → immutable; corrections via new filing.
4. Receipt parse wrong → owner edits before confirming.
5. "Bookkeeping helper, not tax advice" label on every tax screen.

## Out of scope

- Filing returns with CRA/Revenu Québec (summary only).
- US/international tax.

## Acceptance tests

| ID | Test |
|---|---|
| C3-001 | Unit: place-of-supply rates for all 13 provinces/territories. |
| C3-002 | Unit: QST ex-GST math (regression). |
| C3-003 | Unit: override requires reason; logged. |
| C3-004 | Unit: filing summary (collected − paid = net) per type. |
| C3-005 | DB: cross-business isolation. |
| C3-006 | E2E (owner): BC address → GST+PST; QC → GST+QST. |
| C3-007 | E2E: expense receipt → suggested taxes → confirm → in filing. |
| C3-008 | E2E: override with reason → shown on document + logged. |
| C3-009 | A11y + fr-CA. |
| C3-010 | Auth matrix additions. |

## Build checklist

- [ ] Rate table re-verified (links in report).
- [ ] "Not tax advice" labelling everywhere.
- [ ] Migration M24; RLS staged.
- [ ] Feature flag `taxV2`.
- [ ] en-CA + fr-CA; parity green.
- [ ] Tests C3-001…010 green; CI green; report; then stop.
