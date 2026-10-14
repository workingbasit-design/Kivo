-- CreateTable
CREATE TABLE "Membership" (
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
CREATE INDEX "Membership_businessId_status_idx" ON "Membership"("businessId", "status");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_businessId_key" ON "Membership"("userId", "businessId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- M1: CHECK constraints for role/status (Prisma models them as String;
-- the database enforces the allowed vocabularies).
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_role_check" CHECK ("role" IN ('OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN'));
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_status_check" CHECK ("status" IN ('ACTIVE', 'INVITED', 'SUSPENDED', 'REMOVED'));

-- M1 backfill: one ACTIVE Membership per existing User with a business.
-- Role maps from the legacy User.role (OWNER->OWNER, ADMIN->ADMIN,
-- anything else -> TECHNICIAN). Users with NULL businessId (not yet
-- onboarded) get no row. Idempotent: ON CONFLICT skips re-runs.
INSERT INTO "Membership" ("id", "userId", "businessId", "role", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", "businessId",
       CASE WHEN "role" = 'OWNER' THEN 'OWNER' WHEN "role" = 'ADMIN' THEN 'ADMIN' ELSE 'TECHNICIAN' END,
       'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
WHERE "businessId" IS NOT NULL
ON CONFLICT ("userId", "businessId") DO NOTHING;
