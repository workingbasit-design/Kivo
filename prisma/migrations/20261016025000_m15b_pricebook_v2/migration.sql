-- M15: F6 Price Book v2 — extend Service with bilingual names, kind, unit,
-- cost, tax category, category, and active flag. All statements idempotent.
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "nameFr" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "descriptionFr" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'SERVICE';
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'each';
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "costCents" BIGINT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "taxCategory" TEXT NOT NULL DEFAULT 'TAXABLE_GST_HST';
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  ALTER TABLE "Service" ADD CONSTRAINT "Service_kind_check"
    CHECK ("kind" IN ('SERVICE', 'PRODUCT'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Service" ADD CONSTRAINT "Service_taxCategory_check"
    CHECK ("taxCategory" IN ('TAXABLE_GST_HST', 'TAXABLE_PST', 'TAXABLE_QST', 'EXEMPT'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Service_businessId_active_idx"
  ON "Service"("businessId", "active");
