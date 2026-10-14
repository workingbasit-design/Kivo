-- IDEMPOTENT (2026-10-14): safe to re-run. DDL uses IF NOT EXISTS /
-- IF EXISTS guards and DO blocks; DML was already idempotent.
-- M12: composite indexes for main screens (docs/plans/database.md A9).
-- The legacy (businessId, status, date) index on Job is KEPT: M9 did not drop
-- the legacy Job.date column (17 files still read it), so the index stays
-- until the startAt/endAt refactor lands.

CREATE INDEX IF NOT EXISTS "Job_businessId_status_startAt_idx" ON "Job"("businessId", "status", "startAt");
CREATE INDEX IF NOT EXISTS "Job_businessId_customerId_startAt_idx" ON "Job"("businessId", "customerId", "startAt");
CREATE INDEX IF NOT EXISTS "Invoice_businessId_status_dueAt_idx" ON "Invoice"("businessId", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "Payment_businessId_invoiceId_createdAt_idx" ON "Payment"("businessId", "invoiceId", "createdAt");
CREATE INDEX IF NOT EXISTS "Payment_businessId_status_idx" ON "Payment"("businessId", "status");
CREATE INDEX IF NOT EXISTS "Quote_businessId_status_createdAt_idx" ON "Quote"("businessId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Customer_businessId_archivedAt_name_idx" ON "Customer"("businessId", "archivedAt", "name");
