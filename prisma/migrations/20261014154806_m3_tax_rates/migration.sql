-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "filingFrequency" TEXT,
ADD COLUMN     "gstHstRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qstNumber" TEXT;

-- AlterTable
ALTER TABLE "InvoiceLineItem" ADD COLUMN     "taxRateBps" INTEGER,
ADD COLUMN     "taxType" TEXT;

-- AlterTable
ALTER TABLE "QuoteLineItem" ADD COLUMN     "taxRateBps" INTEGER,
ADD COLUMN     "taxType" TEXT;

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceTaxLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "baseCents" BIGINT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceTaxLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxRate_jurisdiction_effectiveFrom_idx" ON "TaxRate"("jurisdiction", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_jurisdiction_taxType_effectiveFrom_key" ON "TaxRate"("jurisdiction", "taxType", "effectiveFrom");

-- CreateIndex
CREATE INDEX "InvoiceTaxLine_invoiceId_idx" ON "InvoiceTaxLine"("invoiceId");

-- AddForeignKey
ALTER TABLE "InvoiceTaxLine" ADD CONSTRAINT "InvoiceTaxLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- M3: CHECK constraints for tax vocabularies and filing frequency.
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_taxType_check" CHECK ("taxType" IN ('GST', 'HST', 'PST', 'RST', 'QST'));
ALTER TABLE "InvoiceTaxLine" ADD CONSTRAINT "InvoiceTaxLine_taxType_check" CHECK ("taxType" IN ('GST', 'HST', 'PST', 'RST', 'QST'));
ALTER TABLE "Business" ADD CONSTRAINT "Business_filingFrequency_check" CHECK ("filingFrequency" IS NULL OR "filingFrequency" IN ('MONTHLY', 'QUARTERLY', 'ANNUAL'));

-- M3: TaxRate immutability — rows are never UPDATED. Corrections = insert a
-- new row with a new effectiveFrom and close the old row's effectiveTo.
CREATE OR REPLACE FUNCTION tax_rates_block_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'TaxRate rows are immutable: insert a new row with a new effectiveFrom and close the old row''s effectiveTo instead of updating';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tax_rates_no_update ON "TaxRate";
CREATE TRIGGER tax_rates_no_update
  BEFORE UPDATE ON "TaxRate"
  FOR EACH ROW EXECUTE FUNCTION tax_rates_block_update();

-- M3: seed Canadian sales-tax rates (general rates, 2026). The owner must
-- verify all rates and service taxability with an accountant before launch
-- (see docs/TAX_NOTES.md). Idempotent: ON CONFLICT skips re-runs.
--
-- rateBps encoding: thousandths of a percent (rateBps / 100000 = fraction),
-- so QST 9.975% is exact (9975). NOTE: the plan's draft glossed "500 = 5%",
-- which is arithmetically inconsistent with its own "9975 = 9.975%" (that
-- gloss requires divisor 100000, under which 500 would mean 0.5%). The
-- divisor that keeps the explicitly-glossed QST value exact is used, and
-- the round rates are encoded on the same scale (GST 5% = 5000).
INSERT INTO "TaxRate" ("id", "jurisdiction", "taxType", "rateBps", "effectiveFrom", "effectiveTo", "createdAt") VALUES
  (gen_random_uuid()::text, 'AB', 'GST', 5000,  '2016-01-01', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'NT', 'GST', 5000,  '2016-01-01', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'NU', 'GST', 5000,  '2016-01-01', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'YT', 'GST', 5000,  '2016-01-01', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'BC', 'GST', 5000,  '2016-01-01', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'BC', 'PST', 7000,  '2016-01-01', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'MB', 'GST', 5000,  '2016-01-01', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'MB', 'RST', 7000,  '2016-01-01', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'SK', 'GST', 5000,  '2016-01-01', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'SK', 'PST', 6000,  '2016-01-01', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ON', 'HST', 13000, '2016-01-01', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'NB', 'HST', 15000, '2016-01-01', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'NL', 'HST', 15000, '2016-01-01', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'PE', 'HST', 15000, '2016-01-01', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'NS', 'HST', 15000, '2010-07-01', '2025-03-31', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'NS', 'HST', 14000, '2025-04-01', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'QC', 'GST', 5000,  '2016-01-01', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'QC', 'QST', 9975,  '2016-01-01', NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("jurisdiction", "taxType", "effectiveFrom") DO NOTHING;
