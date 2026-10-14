-- IDEMPOTENT (2026-10-14): safe to re-run. DDL uses IF NOT EXISTS /
-- IF EXISTS guards and DO blocks; DML was already idempotent.
-- M8: cents cutover — finish the money migration (closes Phases 3-5).
--
-- 1. Backfill every *Cents from its Float column (ROUND to nearest cent).
-- 2. Make *Cents NOT NULL wherever the Float was NOT NULL (nullable Floats
--    keep nullable *Cents: NULL means "not set", distinct from 0).
-- 3. Drop the Float columns.
--
-- NOTE: hand-written (see M6 note). Zero drift verified with `migrate diff`.

-- Quote.discountValue PERCENT guard: when discountType = 'PERCENT',
-- discountValue is a percent (0-100), NOT money — discountValueCents
-- stays NULL and is never multiplied by 100. Only AMOUNT discounts
-- (or null discountType with a value, treated as amount) are backfilled.
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quote' AND column_name = 'discountValue') THEN
    UPDATE "Quote" SET "discountValueCents" = (ROUND("discountValue" * 100))::bigint
WHERE "discountValueCents" IS NULL AND "discountValue" IS NOT NULL
  AND ("discountType" IS NULL OR "discountType" <> 'PERCENT');
  END IF;
END $$;

-- Business.defaultHourlyRate -> defaultHourlyRateCents
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Business' AND column_name = 'defaultHourlyRate') THEN
    UPDATE "Business" SET "defaultHourlyRateCents" = (ROUND("defaultHourlyRate" * 100))::bigint
WHERE "defaultHourlyRateCents" IS NULL AND "defaultHourlyRate" IS NOT NULL;
  END IF;
END $$;
-- defaultHourlyRateCents stays nullable: NULL Float means "not set" (distinct from 0).
ALTER TABLE "Business" DROP COLUMN IF EXISTS "defaultHourlyRate";

-- Job.price -> priceCents
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Job' AND column_name = 'price') THEN
    UPDATE "Job" SET "priceCents" = (ROUND("price" * 100))::bigint
WHERE "priceCents" IS NULL AND "price" IS NOT NULL;
  END IF;
END $$;
ALTER TABLE "Job" ALTER COLUMN "priceCents" SET NOT NULL;
ALTER TABLE "Job" DROP COLUMN IF EXISTS "price";

-- Service.price -> priceCents
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Service' AND column_name = 'price') THEN
    UPDATE "Service" SET "priceCents" = (ROUND("price" * 100))::bigint
WHERE "priceCents" IS NULL AND "price" IS NOT NULL;
  END IF;
END $$;
ALTER TABLE "Service" ALTER COLUMN "priceCents" SET NOT NULL;
ALTER TABLE "Service" DROP COLUMN IF EXISTS "price";

-- Invoice.subtotal -> subtotalCents
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'subtotal') THEN
    UPDATE "Invoice" SET "subtotalCents" = (ROUND("subtotal" * 100))::bigint
WHERE "subtotalCents" IS NULL AND "subtotal" IS NOT NULL;
  END IF;
END $$;
ALTER TABLE "Invoice" ALTER COLUMN "subtotalCents" SET NOT NULL;
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "subtotal";

-- Invoice.taxAmount -> taxAmountCents
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'taxAmount') THEN
    UPDATE "Invoice" SET "taxAmountCents" = (ROUND("taxAmount" * 100))::bigint
WHERE "taxAmountCents" IS NULL AND "taxAmount" IS NOT NULL;
  END IF;
END $$;
ALTER TABLE "Invoice" ALTER COLUMN "taxAmountCents" SET NOT NULL;
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "taxAmount";

-- Invoice.total -> totalCents
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'total') THEN
    UPDATE "Invoice" SET "totalCents" = (ROUND("total" * 100))::bigint
WHERE "totalCents" IS NULL AND "total" IS NOT NULL;
  END IF;
END $$;
ALTER TABLE "Invoice" ALTER COLUMN "totalCents" SET NOT NULL;
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "total";

-- InvoiceLineItem.unitPrice -> unitPriceCents
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'InvoiceLineItem' AND column_name = 'unitPrice') THEN
    UPDATE "InvoiceLineItem" SET "unitPriceCents" = (ROUND("unitPrice" * 100))::bigint
WHERE "unitPriceCents" IS NULL AND "unitPrice" IS NOT NULL;
  END IF;
END $$;
ALTER TABLE "InvoiceLineItem" ALTER COLUMN "unitPriceCents" SET NOT NULL;
ALTER TABLE "InvoiceLineItem" DROP COLUMN IF EXISTS "unitPrice";

-- Payment.amount -> amountCents
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'amount') THEN
    UPDATE "Payment" SET "amountCents" = (ROUND("amount" * 100))::bigint
WHERE "amountCents" IS NULL AND "amount" IS NOT NULL;
  END IF;
END $$;
ALTER TABLE "Payment" ALTER COLUMN "amountCents" SET NOT NULL;
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "amount";

-- Quote.total -> totalCents
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quote' AND column_name = 'total') THEN
    UPDATE "Quote" SET "totalCents" = (ROUND("total" * 100))::bigint
WHERE "totalCents" IS NULL AND "total" IS NOT NULL;
  END IF;
END $$;
ALTER TABLE "Quote" ALTER COLUMN "totalCents" SET NOT NULL;
ALTER TABLE "Quote" DROP COLUMN IF EXISTS "total";

-- Quote.depositAmount -> depositAmountCents
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quote' AND column_name = 'depositAmount') THEN
    UPDATE "Quote" SET "depositAmountCents" = (ROUND("depositAmount" * 100))::bigint
WHERE "depositAmountCents" IS NULL AND "depositAmount" IS NOT NULL;
  END IF;
END $$;
-- depositAmountCents stays nullable: NULL Float means "not set" (distinct from 0).
ALTER TABLE "Quote" DROP COLUMN IF EXISTS "depositAmount";

-- RecurringJob.price -> priceCents (nullable Float, stays nullable)
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RecurringJob' AND column_name = 'price') THEN
    UPDATE "RecurringJob" SET "priceCents" = (ROUND("price" * 100))::bigint
WHERE "priceCents" IS NULL AND "price" IS NOT NULL;
  END IF;
END $$;
-- priceCents stays nullable: NULL Float means "not set" (distinct from 0).
ALTER TABLE "RecurringJob" DROP COLUMN IF EXISTS "price";

-- JobExpense.amount -> amountCents
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'JobExpense' AND column_name = 'amount') THEN
    UPDATE "JobExpense" SET "amountCents" = (ROUND("amount" * 100))::bigint
WHERE "amountCents" IS NULL AND "amount" IS NOT NULL;
  END IF;
END $$;
ALTER TABLE "JobExpense" ALTER COLUMN "amountCents" SET NOT NULL;
ALTER TABLE "JobExpense" DROP COLUMN IF EXISTS "amount";

-- QuoteAddon.price -> priceCents
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'QuoteAddon' AND column_name = 'price') THEN
    UPDATE "QuoteAddon" SET "priceCents" = (ROUND("price" * 100))::bigint
WHERE "priceCents" IS NULL AND "price" IS NOT NULL;
  END IF;
END $$;
ALTER TABLE "QuoteAddon" ALTER COLUMN "priceCents" SET NOT NULL;
ALTER TABLE "QuoteAddon" DROP COLUMN IF EXISTS "price";

-- ChecklistTemplate.price -> priceCents
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ChecklistTemplate' AND column_name = 'price') THEN
    UPDATE "ChecklistTemplate" SET "priceCents" = (ROUND("price" * 100))::bigint
WHERE "priceCents" IS NULL AND "price" IS NOT NULL;
  END IF;
END $$;
-- priceCents stays nullable: NULL Float means "not set" (distinct from 0).
ALTER TABLE "ChecklistTemplate" DROP COLUMN IF EXISTS "price";

-- QuoteDeposit.amount -> amountCents
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'QuoteDeposit' AND column_name = 'amount') THEN
    UPDATE "QuoteDeposit" SET "amountCents" = (ROUND("amount" * 100))::bigint
WHERE "amountCents" IS NULL AND "amount" IS NOT NULL;
  END IF;
END $$;
ALTER TABLE "QuoteDeposit" ALTER COLUMN "amountCents" SET NOT NULL;
ALTER TABLE "QuoteDeposit" DROP COLUMN IF EXISTS "amount";

-- QuoteLineItem.unitPrice -> unitPriceCents
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'QuoteLineItem' AND column_name = 'unitPrice') THEN
    UPDATE "QuoteLineItem" SET "unitPriceCents" = (ROUND("unitPrice" * 100))::bigint
WHERE "unitPriceCents" IS NULL AND "unitPrice" IS NOT NULL;
  END IF;
END $$;
ALTER TABLE "QuoteLineItem" ALTER COLUMN "unitPriceCents" SET NOT NULL;
ALTER TABLE "QuoteLineItem" DROP COLUMN IF EXISTS "unitPrice";

-- Part.unitCost -> unitCostCents
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Part' AND column_name = 'unitCost') THEN
    UPDATE "Part" SET "unitCostCents" = (ROUND("unitCost" * 100))::bigint
WHERE "unitCostCents" IS NULL AND "unitCost" IS NOT NULL;
  END IF;
END $$;
-- unitCostCents stays nullable: NULL Float means "not set" (distinct from 0).
ALTER TABLE "Part" DROP COLUMN IF EXISTS "unitCost";

-- Communication.estValue -> estValueCents (missed in the first pass of the
-- inventory; nullable Float, stays nullable).
DO $$
BEGIN
  -- Skip when the legacy Float column is already gone (re-run safe).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Communication' AND column_name = 'estValue') THEN
    UPDATE "Communication" SET "estValueCents" = (ROUND("estValue" * 100))::bigint
WHERE "estValueCents" IS NULL AND "estValue" IS NOT NULL;
  END IF;
END $$;
-- estValueCents stays nullable: NULL Float means "not set" (distinct from 0).
ALTER TABLE "Communication" DROP COLUMN IF EXISTS "estValue";
