# Tax notes (EveryJob)

> ⚠️ The business owner must verify all rates below and the PST/RST/QST
> taxability of their services with an accountant before launch. This file
> records the seed rates in the database — it is not tax advice.

## Seed rates (general rates, 2026)

Stored in the `TaxRate` table as `rateBps` — thousandths of a percent
(`rateBps / 100000` = fraction, so 5000 = 5% and 9975 = 9.975% exactly).
Sources: Canada Revenue Agency (GST/HST rates), Revenu Québec (QST rate).

| Jurisdiction | Tax | Rate | rateBps |
|---|---|---|---|
| AB, NT, NU, YT | GST | 5% | 5000 |
| BC | GST | 5% | 5000 |
| BC | PST | 7% | 7000 |
| MB | GST | 5% | 5000 |
| MB | RST | 7% | 7000 |
| SK | GST | 5% | 5000 |
| SK | PST | 6% | 6000 |
| ON | HST | 13% | 13000 |
| NB, NL, PE | HST | 15% | 15000 |
| NS | HST | 14% (from 2025-04-01; was 15% until 2025-03-31) | 14000 / 15000 |
| QC | GST | 5% | 5000 |
| QC | QST | 9.975% | 9975 |

> Encoding note: the plan's draft glossed `rateBps` as "500 = 5%", which
> is arithmetically inconsistent with its own "9975 = 9.975%" (that gloss
> requires divisor 100000, under which 500 would mean 0.5%). The migration
> uses the divisor that keeps the explicitly-glossed QST value exact and
> encodes the round rates on the same scale. All rates above are exact.

## Rules the code implements

- **QST on the pre-GST base.** Since 2013-01-01, QST (9.975%) applies to
  the selling price *excluding* GST (the pre-2013 GST-inclusive rule is
  obsolete). `calcTaxCents()` computes every tax line on the same pre-tax
  subtotal, so this falls out naturally — and the test
  `tax-calc.test.mts` asserts QST is computed on the pre-GST base.
- **Rate immutability.** `TaxRate` rows are never updated (database trigger
  `tax_rates_no_update` rejects UPDATEs). A correction = insert a new row
  with a new `effectiveFrom` and close the old row's `effectiveTo`.
- **Sent documents are snapshots.** A finalized invoice renders ONLY from
  its `InvoiceTaxLine` rows (`taxType`, `rateBps`, `baseCents`,
  `amountCents`) plus the `taxRateBps`/`taxType` snapshots on its line
  items. Changing `TaxRate` later never changes a sent document.
- **Registration gate.** Invoices show tax lines only when the business
  is registered (`Business.gstHstRegistered = true`). Unregistered
  businesses must not charge or collect sales tax — the invoice builder
  enforces this server-side.

## What the code deliberately does NOT decide

PST (BC/SK), RST (MB), and QST (QC) generally apply to goods and *some*
services — which services are taxable varies by province and is NOT
decided by this code. The settings surface lets the owner choose which
taxes apply to their services; the default follows the seed table and
the owner confirms with their accountant.
