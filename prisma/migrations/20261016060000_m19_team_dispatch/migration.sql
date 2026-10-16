-- IDEMPOTENT (2026-10-16): safe to re-run. DDL uses IF NOT EXISTS /
-- IF EXISTS guards and DO blocks for column adds.
-- M19 (F4): team dispatch — multi-technician job assignments, visit
-- checklists, customer signatures, and timesheet approval fields.
--
-- RLS: staged only (ENABLE + CREATE POLICY, NOT forced), matching the M11
-- pattern. Until activation, the active defence is the tenant-guard.

-- ---------------------------------------------------------------------------
-- JobAssignment: a job (visit) may be assigned to several technicians.
-- (Job.assignedToId stays for backwards compatibility.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "JobAssignment" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "jobId"      TEXT NOT NULL REFERENCES "Job"("id") ON DELETE CASCADE,
  "userId"     TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedById" TEXT,
  CONSTRAINT "JobAssignment_job_user_unique" UNIQUE ("jobId", "userId")
);

CREATE INDEX IF NOT EXISTS "JobAssignment_businessId_idx" ON "JobAssignment"("businessId");
CREATE INDEX IF NOT EXISTS "JobAssignment_userId_idx" ON "JobAssignment"("userId", "businessId");
CREATE INDEX IF NOT EXISTS "JobAssignment_jobId_idx" ON "JobAssignment"("jobId");

-- ---------------------------------------------------------------------------
-- JobChecklistItem: per-visit checklist the technician ticks off.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "JobChecklistItem" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "jobId"      TEXT NOT NULL REFERENCES "Job"("id") ON DELETE CASCADE,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "label"      TEXT NOT NULL,
  "done"       BOOLEAN NOT NULL DEFAULT FALSE,
  "position"   INTEGER NOT NULL DEFAULT 0,
  "createdBy"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "JobChecklistItem_job_idx" ON "JobChecklistItem"("jobId", "position");

-- ---------------------------------------------------------------------------
-- VisitSignature: customer signature captured on visit completion.
-- The drawn signature image lives in Blob; imageUrl is the stored URL.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "VisitSignature" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "jobId"      TEXT NOT NULL REFERENCES "Job"("id") ON DELETE CASCADE,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "signerName" TEXT NOT NULL,
  "imageUrl"   TEXT,
  "signedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy"  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "VisitSignature_job_idx" ON "VisitSignature"("jobId");

-- ---------------------------------------------------------------------------
-- TimeEntry: owner approval of timesheets.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'TimeEntry' AND column_name = 'approvedAt'
  ) THEN
    ALTER TABLE "TimeEntry" ADD COLUMN "approvedAt" TIMESTAMP(3);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'TimeEntry' AND column_name = 'approvedById'
  ) THEN
    ALTER TABLE "TimeEntry" ADD COLUMN "approvedById" TEXT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS: staged (not forced) — same pattern as M11.
-- ---------------------------------------------------------------------------
ALTER TABLE "JobAssignment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JobAssignment_tenant_isolation" ON "JobAssignment";
CREATE POLICY "JobAssignment_tenant_isolation" ON "JobAssignment"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "JobChecklistItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JobChecklistItem_tenant_isolation" ON "JobChecklistItem";
CREATE POLICY "JobChecklistItem_tenant_isolation" ON "JobChecklistItem"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "VisitSignature" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "VisitSignature_tenant_isolation" ON "VisitSignature";
CREATE POLICY "VisitSignature_tenant_isolation" ON "VisitSignature"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));
