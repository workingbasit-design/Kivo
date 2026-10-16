-- IDEMPOTENT: safe to re-run. DDL uses IF NOT EXISTS guards.
-- M16: F9 reports — tax-paid fields on JobExpense so the expense report and
-- the C3 sales-tax summary can show tax paid per category. Additive columns
-- with defaults; existing rows read as 0 (no backfill needed).

ALTER TABLE "JobExpense" ADD COLUMN IF NOT EXISTS "taxGstHstCents" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "JobExpense" ADD COLUMN IF NOT EXISTS "taxQstCents" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "JobExpense" ADD COLUMN IF NOT EXISTS "taxPstCents" BIGINT NOT NULL DEFAULT 0;
