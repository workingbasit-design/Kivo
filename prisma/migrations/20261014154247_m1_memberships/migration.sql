-- IDEMPOTENT (2026-10-14): safe to re-run. DDL uses IF NOT EXISTS /
-- IF EXISTS guards and DO blocks; DML was already idempotent.
-- CreateTable
CREATE TABLE IF NOT EXISTS "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Membership_businessId_status_idx" ON "Membership"("businessId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Membership_userId_businessId_key" ON "Membership"("userId", "businessId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Membership_userId_fkey') THEN
    ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Membership_businessId_fkey') THEN
    ALTER TABLE "Membership" ADD CONSTRAINT "Membership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- M1: CHECK constraints for role/status (Prisma models them as String;
-- the database enforces the allowed vocabularies).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Membership_role_check') THEN
    ALTER TABLE "Membership" ADD CONSTRAINT "Membership_role_check" CHECK ("role" IN ('OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN'));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Membership_status_check') THEN
    ALTER TABLE "Membership" ADD CONSTRAINT "Membership_status_check" CHECK ("status" IN ('ACTIVE', 'INVITED', 'SUSPENDED', 'REMOVED'));
  END IF;
END $$;

-- M1 backfill: one ACTIVE Membership per existing User with a business.
-- Role maps from the legacy User.role (OWNER->OWNER, ADMIN->ADMIN,
-- anything else -> TECHNICIAN). Users with NULL businessId (not yet
-- onboarded) get no row. Idempotent: ON CONFLICT skips re-runs.
DO $$
BEGIN
  -- Skip when the legacy User.businessId/role columns are already gone (m9 dropped
  -- them; the backfill already ran). Re-run safe.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'businessId') THEN
    INSERT INTO "Membership" ("id", "userId", "businessId", "role", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", "businessId",
       CASE WHEN "role" = 'OWNER' THEN 'OWNER' WHEN "role" = 'ADMIN' THEN 'ADMIN' ELSE 'TECHNICIAN' END,
       'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
WHERE "businessId" IS NOT NULL
ON CONFLICT ("userId", "businessId") DO NOTHING;
  END IF;
END $$;
