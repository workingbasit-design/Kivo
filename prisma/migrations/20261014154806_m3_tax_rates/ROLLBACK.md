# Rollback: M3 tax rates

Reverse SQL:
```sql
DROP TRIGGER IF EXISTS tax_rates_no_update ON "TaxRate";
DROP FUNCTION IF EXISTS tax_rates_block_update();
DROP TABLE "InvoiceTaxLine";
DROP TABLE "TaxRate";
ALTER TABLE "Business" DROP CONSTRAINT IF EXISTS "Business_filingFrequency_check";
ALTER TABLE "Business" DROP COLUMN IF EXISTS "gstHstRegistered";
ALTER TABLE "Business" DROP COLUMN IF EXISTS "qstNumber";
ALTER TABLE "Business" DROP COLUMN IF EXISTS "filingFrequency";
ALTER TABLE "InvoiceLineItem" DROP COLUMN IF EXISTS "taxRateBps";
ALTER TABLE "InvoiceLineItem" DROP COLUMN IF EXISTS "taxType";
ALTER TABLE "QuoteLineItem" DROP COLUMN IF EXISTS "taxRateBps";
ALTER TABLE "QuoteLineItem" DROP COLUMN IF EXISTS "taxType";
```
Then `prisma migrate resolve --rolled-back 20261014154806_m3_tax_rates` and
redeploy the previous release (which uses the in-code `CA_TAXES` table).
Data note: seed rates are static reference data; snapshots on invoices
created after M3 would be lost.
