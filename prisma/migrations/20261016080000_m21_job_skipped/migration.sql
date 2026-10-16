-- M21 (F3): Add skippedAt to Job for skipping recurring visits.
-- Skipped visits stay visible (not deleted), excluded from schedule/invoicing.

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "skippedAt" TIMESTAMPTZ;
