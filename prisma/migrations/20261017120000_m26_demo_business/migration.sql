-- Part 0 (dashboard rebuild): demo business support.
-- Business.isDemo marks the seeded demo business so the UI can label it
-- "Demo" everywhere (banner, name suffix). Never set for real businesses.
-- User.activeMembershipId is an explicit business-context override chosen by
-- the user (the Settings "Demo business" switch). NULL = earliest ACTIVE
-- membership, preserving the previous behaviour. The lookup is guarded in
-- getActiveMembershipForUser (must be ACTIVE and belong to the user), so no
-- FK constraint is needed here.

ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeMembershipId" TEXT;
