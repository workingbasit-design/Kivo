-- m33: link unmatched directory requests to the signed-in customer who
-- filed them (2026-11-16 deep test, Defect 1).
--
-- The generic /directory/request form saves an unmatched request as an
-- OPEN DirectoryRequest with no customer link, so the requester could
-- never see it in /customer/requests (which lists QuoteRequest rows by
-- customerId). Adding an optional customerId lets a signed-in customer's
-- unmatched request appear there as an open lead draft, and lets them
-- withdraw it (status -> DISMISSED).
--
-- Safe: nullable column, no existing rows are touched (all stay null =
-- anonymous, as before), FK is SET NULL so deleting a customer account
-- never deletes demand data. Idempotent: every statement is guarded, so
-- a re-run after a partial apply - or two builds racing - converges.
ALTER TABLE "DirectoryRequest" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DirectoryRequest_customerId_fkey') THEN
    ALTER TABLE "DirectoryRequest" ADD CONSTRAINT "DirectoryRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "DirectoryRequest_customerId_idx" ON "DirectoryRequest"("customerId");
