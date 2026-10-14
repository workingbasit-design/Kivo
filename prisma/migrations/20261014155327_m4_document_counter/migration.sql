-- IDEMPOTENT (2026-10-14): safe to re-run. DDL uses IF NOT EXISTS /
-- IF EXISTS guards and DO blocks; DML was already idempotent.
-- M4: DocumentCounter + CreditNote.number. The generated ALTER is
-- rewritten: add the column nullable, backfill, then SET NOT NULL so the
-- migration works on tables that already have rows.

-- AlterTable (hand-edited for backfill safety)
ALTER TABLE "CreditNote" ADD COLUMN IF NOT EXISTS "number" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "DocumentCounter" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "prefix" TEXT NOT NULL,
    "padding" INTEGER NOT NULL DEFAULT 4,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DocumentCounter_businessId_idx" ON "DocumentCounter"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentCounter_businessId_docType_key" ON "DocumentCounter"("businessId", "docType");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentCounter_businessId_fkey') THEN
    ALTER TABLE "DocumentCounter" ADD CONSTRAINT "DocumentCounter_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- M4: CHECK constraint for the document-type vocabulary.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentCounter_docType_check') THEN
    ALTER TABLE "DocumentCounter" ADD CONSTRAINT "DocumentCounter_docType_check" CHECK ("docType" IN ('QUOTE', 'INVOICE', 'CREDIT_NOTE'));
  END IF;
END $$;

-- M4 backfill 1: existing credit notes get CN-0001, CN-0002, ... per
-- business in creation order, then the column goes NOT NULL.
WITH ranked AS (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "businessId" ORDER BY "createdAt", "id") AS rn
  FROM "CreditNote"
)
UPDATE "CreditNote" cn
SET "number" = 'CN-' || LPAD(ranked.rn::text, 4, '0')
FROM ranked
WHERE cn."id" = ranked."id" AND cn."number" IS NULL;

ALTER TABLE "CreditNote" ALTER COLUMN "number" SET NOT NULL;

-- M4 backfill 2: one counter row per business x doc type, seeded from the
-- max existing document number (or 1 when the business has none yet).
-- Existing prefixes are kept: INV- for invoices, Q- for quotes.
INSERT INTO "DocumentCounter" ("id", "businessId", "docType", "nextNumber", "prefix", "padding", "updatedAt")
SELECT gen_random_uuid()::text, b."id", 'INVOICE',
       COALESCE((
         SELECT MAX((regexp_match(i."number", '^INV-(\d+)$'))[1]::int)
         FROM "Invoice" i WHERE i."businessId" = b."id"
       ), 0) + 1,
       'INV-', 4, CURRENT_TIMESTAMP
FROM "Business" b
ON CONFLICT ("businessId", "docType") DO NOTHING;

INSERT INTO "DocumentCounter" ("id", "businessId", "docType", "nextNumber", "prefix", "padding", "updatedAt")
SELECT gen_random_uuid()::text, b."id", 'QUOTE',
       COALESCE((
         SELECT MAX((regexp_match(q."number", '^Q-(\d+)$'))[1]::int)
         FROM "Quote" q WHERE q."businessId" = b."id"
       ), 0) + 1,
       'Q-', 4, CURRENT_TIMESTAMP
FROM "Business" b
ON CONFLICT ("businessId", "docType") DO NOTHING;

INSERT INTO "DocumentCounter" ("id", "businessId", "docType", "nextNumber", "prefix", "padding", "updatedAt")
SELECT gen_random_uuid()::text, b."id", 'CREDIT_NOTE',
       COALESCE((SELECT COUNT(*) FROM "CreditNote" cn WHERE cn."businessId" = b."id"), 0) + 1,
       'CN-', 4, CURRENT_TIMESTAMP
FROM "Business" b
ON CONFLICT ("businessId", "docType") DO NOTHING;
