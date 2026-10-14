-- IDEMPOTENT (2026-10-14): safe to re-run. DDL uses IF NOT EXISTS /
-- IF EXISTS guards and DO blocks; DML was already idempotent.
-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomerLink" (
    "id" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerLink_customerUserId_idx" ON "CustomerLink"("customerUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerLink_customerId_idx" ON "CustomerLink"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerLink_businessId_idx" ON "CustomerLink"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerLink_customerUserId_customerId_businessId_key" ON "CustomerLink"("customerUserId", "customerId", "businessId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerLink_customerUserId_fkey') THEN
    ALTER TABLE "CustomerLink" ADD CONSTRAINT "CustomerLink_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "CustomerUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerLink_customerId_fkey') THEN
    ALTER TABLE "CustomerLink" ADD CONSTRAINT "CustomerLink_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerLink_businessId_fkey') THEN
    ALTER TABLE "CustomerLink" ADD CONSTRAINT "CustomerLink_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
