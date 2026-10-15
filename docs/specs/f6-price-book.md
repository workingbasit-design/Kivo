# F6: Price Book — Spec

**Status:** Draft — awaiting user OK before build.
**Date:** 2026-10-15
**Tier:** 1 (build after F5)

## Goal

Services and products with bilingual names/descriptions, unit, default
price, cost, tax category, and category. Quick-add to quotes and invoices.
Margin shown.

## Current state

`Service` model exists (name, priceCents, durationMin, description) with a
page at `/pricebook`. F6 expands it; existing services migrate cleanly.

## Personas & user stories

### Owner / Admin
- As an owner, I add a service: name + description in English and French,
  unit (each/hour/job), default price, my cost, tax category, category.
- As an owner, I see the margin on each item (price − cost, % shown).
- As an owner building a quote, I tap "Add from price book", search, tap
  the item — the line appears with price and tax category pre-filled.
- As an owner, I set some items as products (materials) vs services (labour).

### Dispatcher
- Same quick-add when building quotes/jobs.

## Data model (migration M19)

Extend `Service`:
- `nameFr String?`, `descriptionFr String?` (bilingual)
- `kind String @default('SERVICE')` — SERVICE | PRODUCT
- `unit String @default('each')` — each | hour | job | sqft (free text OK)
- `costCents BigInt?` (owner's cost, for margin)
- `taxCategory String @default('TAXABLE_GST_HST')` — TAXABLE_GST_HST |
  TAXABLE_PST | TAXABLE_QST | EXEMPT (feeds F2 PDFs + C3 tax engine)
- `category String?` (e.g., Plumbing, Electrical — owner-defined)

Margin is derived (`priceCents - costCents`), never stored.

## Permissions

| Action | Owner/Admin | Dispatcher | Technician |
|---|---|---|---|
| Manage price book | ✅ | ✅ | ❌ |
| View price book | ✅ | ✅ | ❌ (no prices for techs — F4) |
| Quick-add to quote/invoice | ✅ | ✅ | ❌ |

## Tenant isolation

`Service.businessId` required (exists). Quick-add only lists the business's
own items. Negative test: Business B cannot list/use Business A's items.

## Screens (390px ASCII)

```
+--------------------------------------+
|  Price book               [+ Add]    |
|  [Search services...]                |
+--------------------------------------+
| Drain cleaning            $149.00    |
| each · Plumbing · margin 62%        |
+--------------------------------------+
| Camera inspection          $89.00    |
| each · Plumbing · margin 55%        |
+--------------------------------------+
```

Quick-add sheet (from quote):
```
+--------------------------------------+
|  Add from price book        [x]      |
|  [Search...]                         |
|  [x] Drain cleaning  $149.00        |
|  [ ] Camera inspection $89.00       |
|  [ Add 1 item ]                      |
+--------------------------------------+
```

## Edge cases

1. Price book item deleted → existing quote/invoice lines keep their
   snapshot (lines are copies, not references).
2. Price changed → only new lines use the new price.
3. Tax category drives F2 PDF tax lines and C3 summaries.
4. French name missing → falls back to English name (flagged "needs
   translation" in list).
5. Cost unset → margin hidden (not 100%).

## Out of scope

- Inventory counts / stock (explicitly not now).
- Supplier management.
- Importing a price book from CSV (v1: manual add; CSV later).

## Acceptance tests

| ID | Test |
|---|---|
| F6-001 | Unit: margin calc (incl. null cost → hidden). |
| F6-002 | Unit: tax category → correct tax lines via calcTax. |
| F6-003 | DB: cross-business isolation. |
| F6-004 | E2E (owner): add service en+fr → appears in list with margin. |
| F6-005 | E2E (owner): quick-add to quote → line pre-filled, total correct. |
| F6-006 | E2E: delete item → existing quote lines unchanged. |
| F6-007 | E2E (technician): price book returns 403. |
| F6-008 | E2E (fr-CA): French names/descriptions shown. |
| F6-009 | A11y: axe, zero serious/critical. |
| F6-010 | Auth matrix: new actions added. |

## Build checklist

- [ ] Migration M19 (idempotent); RLS staged.
- [ ] Feature flag `pricebookV2`.
- [ ] en-CA + fr-CA; parity green.
- [ ] Tests F6-001…010 green; tsc/lint/build green.
- [ ] CI green; report with evidence; then stop.
