-- M16: F10 Notifications and Search — extend the existing in-app Notification
-- model so event-driven notifications can link back to their source record
-- and (optionally) target a single business member.
--
-- Adds:
--   entityType  TEXT NULL  — 'LEAD' | 'QUOTE' | 'INVOICE' | 'PAYMENT' | 'JOB' | 'BOOKING'
--   entityId    TEXT NULL  — id of the source record (for "no longer available" states)
--   userId      TEXT NULL  — when set, only this user sees the notification
--                            (technician-scoped events); NULL = whole business.
--
-- Idempotent: every statement uses IF NOT EXISTS. Safe to re-run.
-- No backfill needed: NULLs are the correct value for all existing rows.

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "entityType" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "entityId" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE INDEX IF NOT EXISTS "Notification_entityType_entityId_idx"
  ON "Notification"("entityType", "entityId");

CREATE INDEX IF NOT EXISTS "Notification_userId_idx"
  ON "Notification"("userId");
