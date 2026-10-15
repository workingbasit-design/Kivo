# F2: PDF Quotes and Invoices — Spec

**Status:** Draft — awaiting user OK before build.
**Date:** 2026-10-15
**Tier:** 1 (build after F1; F1's Download PDF button links here)

## Goal

Branded PDFs for quotes and invoices, in the customer's language (en-CA /
fr-CA), matching the screen to the cent. Include everything the CRA requires
for input tax credit claims.

## Dependency decision (needs user approval)

No PDF library is installed. Recommendation: **`pdfkit`** (`^0.17.x`).

- Pure JavaScript, no native bindings → works in Vercel serverless.
- Precise layout control (needed for CRA-compliant tax lines).
- `@react-pdf/renderer` is heavier and flaky in serverless; headless-Chrome
  PDF is not feasible on Hobby.
- License: MIT. `npm audit` will be re-checked after install (CI gate).

Alternative if the user prefers: `@react-pdf/renderer`. The spec below is
library-agnostic; only the renderer module changes.

## Personas & user stories

### Customer
- As a customer, I tap "Download PDF" on my quote/invoice link and get a
  file named `Quote-Q-1042-Maple-Leaf-Plumbing.pdf` that opens on my phone.
- As a customer, the PDF shows the business's legal name, address, and tax
  numbers; my name and service address; every line item; each tax on its own
  line; totals; payment terms and due date; deposit paid and balance; and how
  to pay (card link + e-Transfer email and reference code).

### Owner / Admin
- As an owner, I can download the same PDF from the quote/invoice page in
  the app.
- As an owner, my logo, brand colors, legal name, address, GST/HST number,
  QST number (QC), and licence number (e.g., RBQ) appear on the PDF once set
  in Settings — I don't retype them per document.
- As an owner, the PDF total always matches the screen total to the cent
  (tested).

## Layout (single page, A4/Letter)

```
+--------------------------------------------------+
| [logo]  MAPLE LEAF PLUMBING INC.                 |
|         123 Main St, Toronto ON M4B 1B3          |
|         GST/HST: 123456789RT0001                 |
|         Licence RBQ: 1234-5678-90                |
+--------------------------------------------------+
| QUOTE Q-1042                    Date: Oct 15 2026|
| Valid until: Nov 5 2026                          |
+--------------------------------------------------+
| Bill to: Jane Doe                                |
| 456 Oak Ave, Toronto ON                          |
| Service address: (same)                          |
+--------------------------------------------------+
| Description              Qty    Price      Amount |
| Drain cleaning            1   $149.00    $149.00 |
| Camera inspection (opt.)  1    $89.00     $89.00 |
+--------------------------------------------------+
| Subtotal                                   $238.00|
| GST (5%)                                    $11.90|
| Total                                      $249.90|
| Deposit required (20%)                       $49.98|
+--------------------------------------------------+
| Payment terms: Due on receipt.                       |
| Pay by card: <link>  |  e-Transfer: pay@maple.ca |
| Reference: Q-1042                                    |
+--------------------------------------------------+
| Acceptance: ________________  Date: __________    |
+--------------------------------------------------+
```

Invoice variant: "INVOICE INV-0031", due date, "Balance owing", payment
history table, deposit paid line.

## Mobile entry points (390px ASCII)

The PDF is generated server-side; the mobile UI is the download/share
entry point on the quote/invoice page (app) and on the customer portal link
(F1).

```
+--------------------------------------+
|  < Quote Q-1042                       |
|                                      |
|  Drain cleaning         $149.00      |
|  Camera inspection       $89.00      |
|  Subtotal               $238.00      |
|  GST (5%)                $11.90      |
|  Total                  $249.90      |
|                                      |
|  [ Download PDF ]                    |
|  [ Share link ]   [ Copy link ]       |
|                                      |
|  Status: SENT · Viewed 2h ago        |
+--------------------------------------+
```

Customer portal (F1) shows the same [ Download PDF ] button under the
document; the file name is `Quote-Q-1042-<Business>.pdf` /
`Invoice-INV-0031-<Business>.pdf`.

## CRA input tax credit requirements

Per the CRA (verify current list at build time — do not rely on memory),
a document supporting an ITC claim generally shows: supplier's name and
GST/HST registration number; invoice date and number; recipient name;
description of goods/services; and the tax charged or rate. The PDF includes
all of these; tax numbers only render when the business is registered
(`gstHstRegistered`, `qstNumber` set). **Owner to verify with a professional**
that the template meets current CRA/Revenu Québec requirements.

## Data model

No new tables. New fields on `Business` (migration M15):
- `legalName String?` (defaults to `name`)
- `businessAddress String?` (multi-line)
- `licenceNumber String?` (e.g., RBQ; label is free text)
- `logoBlobUrl String?` (reuse existing logo upload)

PDFs are generated on demand (not stored) — deterministic from the
quote/invoice row + business settings. `Cache-Control: private, max-age=3600`.

## Permissions

| Action | Link holder | Owner/Admin | Others |
|---|---|---|---|
| Download quote/invoice PDF | ✅ (valid token) | ✅ | ❌ |

Route: `GET /api/pdf/quote/[token]`, `GET /api/pdf/invoice/[token]` (token
auth), plus `GET /api/pdf/quote/by-id/[id]` (session auth, business app).
Rate limited like other token routes. Every query scoped by token's
businessId.

## Tenant isolation

PDF renderer receives only the looked-up document row (already scoped by
token/session). No businessId parameter from the client. Negative test:
token for Business A's quote cannot render Business B's invoice.

## Edge cases

1. Amounts: all math in integer cents; formatted with the same `formatMoney`
   used on screen. Rounding: per-line then sum (matches `calcTax`).
2. Long line-item lists → multi-page with repeated header + "continued".
3. Logo missing → text header only (no broken image).
4. fr-CA: labels translated; amounts formatted fr-CA (`249,90 $`); Quebec
   businesses default to French (F1 customer locale).
5. Tax-exempt business → no tax lines, no tax numbers, note "No tax charged".
6. QST: 9.975% on price excluding GST (never "fix" this).
7. Void invoice → watermark "VOID".
8. PDF/A compliance: not required for v1.

## Out of scope

- Storing PDFs in Blob (on-demand only for v1).
- Emailing the PDF as attachment (F5 covers sending the link).
- Custom templates per business (one branded template for v1).

## Acceptance tests

| ID | Test |
|---|---|
| F2-001 | Unit: PDF totals equal screen totals to the cent (cents → formatted). |
| F2-002 | Unit: tax lines render per tax type; QST = 9.975% ex-GST. |
| F2-003 | Unit: tax numbers hidden when business not registered. |
| F2-004 | E2E: download quote PDF via link → valid PDF, contains number + total. |
| F2-005 | E2E: download invoice PDF → contains balance, payment history. |
| F2-006 | E2E: Business B token cannot fetch Business A's PDF (404). |
| F2-007 | E2E (fr-CA): French labels, fr-CA amounts, no English. |
| F2-008 | A11y: PDF is tagged (pdfkit accessibility where feasible); link text clear. |
| F2-009 | Auth matrix: new routes added; token-gated, rate limited. |

## Build checklist

- [ ] User approves `pdfkit` (or picks alternative).
- [ ] `npm audit` clean after install (CI gate).
- [ ] CRA field list verified against current CRA publications (link in report).
- [ ] Migration M15 (idempotent).
- [ ] en-CA + fr-CA; i18n parity green.
- [ ] Cent-exact tests F2-001…009 green.
- [ ] CI green; report with evidence; then stop.
