-- M12: composite indexes for main screens (docs/plans/database.md A9).
-- The legacy (businessId, status, date) index on Job is KEPT: M9 did not drop
-- the legacy Job.date column (17 files still read it), so the index stays
-- until the startAt/endAt refactor lands.

CREATE INDEX "Job_businessId_status_startAt_idx" ON "Job"("businessId", "status", "startAt");
CREATE INDEX "Job_businessId_customerId_startAt_idx" ON "Job"("businessId", "customerId", "startAt");
CREATE INDEX "Invoice_businessId_status_dueAt_idx" ON "Invoice"("businessId", "status", "dueAt");
CREATE INDEX "Payment_businessId_invoiceId_createdAt_idx" ON "Payment"("businessId", "invoiceId", "createdAt");
CREATE INDEX "Payment_businessId_status_idx" ON "Payment"("businessId", "status");
CREATE INDEX "Quote_businessId_status_createdAt_idx" ON "Quote"("businessId", "status", "createdAt");
CREATE INDEX "Customer_businessId_archivedAt_name_idx" ON "Customer"("businessId", "archivedAt", "name");
