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
-- NOTE (2026-10-16 fix): this table already exists from the init baseline
-- with (id, jobId, label, done, sortOrder, createdAt) — matching
-- schema.prisma. An earlier revision of this block declared
-- position/businessId/createdBy, which do not exist in the schema; on a
-- fresh `prisma migrate deploy` the guarded CREATE TABLE was a no-op and the
-- index on ("jobId","position") failed with P3018 (column "position" does
-- not exist). Keep the CREATE as a guarded no-op with the real shape, and
-- ensure the schema's @@index([jobId]).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "JobChecklistItem" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "jobId"     TEXT NOT NULL REFERENCES "Job"("id") ON DELETE CASCADE,
  "label"     TEXT NOT NULL,
  "done"      BOOLEAN NOT NULL DEFAULT FALSE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "JobChecklistItem_jobId_idx" ON "JobChecklistItem"("jobId");

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

-- NOTE (2026-10-16 fix): no tenant RLS policy for JobChecklistItem — the
-- table has no businessId column in schema.prisma (tenant isolation flows
-- through Job). The earlier policy referencing "businessId" would fail on a
-- fresh deploy with column "businessId" does not exist.

ALTER TABLE "VisitSignature" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "VisitSignature_tenant_isolation" ON "VisitSignature";
CREATE POLICY "VisitSignature_tenant_isolation" ON "VisitSignature"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));
