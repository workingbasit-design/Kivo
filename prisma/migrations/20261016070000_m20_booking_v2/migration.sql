-- M20: F7 Online Booking — approval workflow, bookable services, deposits.
--
-- Adds to BookingPage:
--   approvalRequired BOOLEAN DEFAULT TRUE — customer requests need owner approval
--   bufferMin        INTEGER  DEFAULT 30   — buffer minutes between visits
--   depositRequired  BOOLEAN DEFAULT FALSE — require a deposit at booking time
--   depositCents     BIGINT  NULL          — deposit amount in cents
--   embedEnabled     BOOLEAN DEFAULT TRUE  — allow the /embed widget
--
-- New tables:
--   BookableService — which price-book services are bookable online (per page)
--   BookingRequest  — customer booking submissions; NOT a Job until approved
--                     (approval-required mode). Instant mode creates the Job
--                     directly and marks the request APPROVED.
--
-- RLS: staged (ENABLED, NOT FORCED) per the M11 pattern — the app connects as
-- the table owner, so nothing changes until the activation checklist in
-- docs/SECURITY_REPORT.md is completed. Do NOT add FORCE here.
--
-- Idempotent: every statement uses IF NOT EXISTS / IF EXISTS guards.
-- Safe to re-run.

ALTER TABLE "BookingPage" ADD COLUMN IF NOT EXISTS "approvalRequired" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "BookingPage" ADD COLUMN IF NOT EXISTS "bufferMin" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "BookingPage" ADD COLUMN IF NOT EXISTS "depositRequired" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "BookingPage" ADD COLUMN IF NOT EXISTS "depositCents" BIGINT;
ALTER TABLE "BookingPage" ADD COLUMN IF NOT EXISTS "embedEnabled" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS "BookableService" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "bookingPageId" TEXT NOT NULL,
  "serviceId"     TEXT NOT NULL,
  "businessId"    TEXT NOT NULL,
  "position"      INTEGER NOT NULL DEFAULT 0,
  "active"        BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookableService_bookingPageId_fkey" FOREIGN KEY ("bookingPageId") REFERENCES "BookingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookableService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookableService_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "BookableService_bookingPageId_serviceId_key"
  ON "BookableService"("bookingPageId", "serviceId");
CREATE INDEX IF NOT EXISTS "BookableService_businessId_idx"
  ON "BookableService"("businessId");
CREATE INDEX IF NOT EXISTS "BookableService_bookingPageId_position_idx"
  ON "BookableService"("bookingPageId", "position");

CREATE TABLE IF NOT EXISTS "BookingRequest" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "businessId"    TEXT NOT NULL,
  "bookingPageId" TEXT NOT NULL,
  "serviceId"     TEXT,
  "customerName"  TEXT NOT NULL,
  "phone"         TEXT NOT NULL,
  "phoneNorm"     TEXT,
  "email"         TEXT,
  "address"       TEXT,
  "notes"         TEXT,
  "slotStart"     TIMESTAMP(3),
  "slotEnd"       TIMESTAMP(3),
  "durationMin"   INTEGER,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "jobId"         TEXT,
  "customerId"    TEXT,
  "depositCents"  BIGINT,
  "depositPaidAt" TIMESTAMP(3),
  "confirmToken"  TEXT NOT NULL,
  "createdBy"     TEXT,
  "updatedBy"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingRequest_bookingPageId_fkey" FOREIGN KEY ("bookingPageId") REFERENCES "BookingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookingRequest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BookingRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookingRequest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BookingRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "BookingRequest_confirmToken_key"
  ON "BookingRequest"("confirmToken");
CREATE INDEX IF NOT EXISTS "BookingRequest_businessId_status_idx"
  ON "BookingRequest"("businessId", "status");
CREATE INDEX IF NOT EXISTS "BookingRequest_bookingPageId_idx"
  ON "BookingRequest"("bookingPageId");

-- RLS staged (see M11 header): enabled, not forced.
ALTER TABLE "BookableService" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BookableService_tenant_isolation" ON "BookableService";
CREATE POLICY "BookableService_tenant_isolation" ON "BookableService"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "BookingRequest" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BookingRequest_tenant_isolation" ON "BookingRequest";
CREATE POLICY "BookingRequest_tenant_isolation" ON "BookingRequest"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));
