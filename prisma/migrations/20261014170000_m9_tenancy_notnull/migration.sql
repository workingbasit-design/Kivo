-- M9: tenancy NOT NULL + drop legacy User.role / User.businessId.
--
-- Payment.businessId NOT NULL: no NULL rows exist on any migrated database
-- (M8 backfill covered it; verified 0 NULLs on the scratch DB 2026-10-14).
-- Business.timezone NOT NULL with default 'America/Toronto' (Canada-only app).
-- User.role / User.businessId dropped: Membership (M1, backfilled 1:1 from
-- User rows) is now the authority for role + business assignment. The session's
-- business context resolves via the user's ACTIVE membership in requireAuth().
--
-- NOT done here (plan-conditional, blocked): dropping legacy Job.date/Job.time.
-- The plan requires dropping them only after a code grep proves zero reads
-- remain. The grep (2026-10-14) still finds reads in:
--   dashboard/page.tsx, jobs/[id]/page.tsx, jobs/[id]/edit/page.tsx,
--   jobs/page.tsx, reminders/page.tsx, review-requests.ts, reminders.ts,
--   track/[token]/page.tsx, ScheduleClient.tsx, DispatchBoardClient.tsx,
--   job-status.ts, google-calendar.ts, messaging/scheduler.ts, recurring.ts,
--   googleCalendarSync.ts, insights-compute.ts, GlobalCopilotWidget.tsx.
-- Migrating all of those to startAt/endAt is a separate refactor; the columns
-- stay until it is done. (The (businessId, status, date) index also stays
-- until M12 recreates it on startAt.)

-- 1. Payment.businessId NOT NULL
ALTER TABLE "Payment" ALTER COLUMN "businessId" SET NOT NULL;

-- 2. Business.timezone NOT NULL with default
UPDATE "Business" SET "timezone" = 'America/Toronto' WHERE "timezone" IS NULL;
ALTER TABLE "Business" ALTER COLUMN "timezone" SET DEFAULT 'America/Toronto';
ALTER TABLE "Business" ALTER COLUMN "timezone" SET NOT NULL;

-- 3. Drop User.businessId (FK first) and User.role
ALTER TABLE "User" DROP CONSTRAINT "User_businessId_fkey";
ALTER TABLE "User" DROP COLUMN "businessId";
ALTER TABLE "User" DROP COLUMN "role";
