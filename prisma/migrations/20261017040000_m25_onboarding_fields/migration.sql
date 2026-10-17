-- E7: first-run onboarding fields on Business.
-- teamSize: '1' | '2-5' | '6+' (set by the 3-question first-run flow).
-- onboardingDone: false until the business completes or skips first run.
-- Backfill: businesses that already have real data (jobs or customers)
-- are past first run, so they are marked done and never see the flow.

ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "teamSize" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "onboardingDone" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Business" SET "onboardingDone" = true
WHERE EXISTS (SELECT 1 FROM "Job" WHERE "Job"."businessId" = "Business"."id")
   OR EXISTS (SELECT 1 FROM "Customer" WHERE "Customer"."businessId" = "Business"."id");
