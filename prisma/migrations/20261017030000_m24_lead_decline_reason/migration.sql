-- M24 (E5): Add declineReason to Lead for lead triage with reason capture.

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "declineReason" TEXT;
