-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEvent_businessId_createdAt_idx" ON "AuditEvent"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_businessId_entityType_entityId_idx" ON "AuditEvent"("businessId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- M5: CHECK constraints for the actor/action vocabularies.
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorType_check"
  CHECK ("actorType" IN ('USER', 'SYSTEM', 'WEBHOOK', 'COPILOT'));
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_action_check"
  CHECK ("action" IN (
    'MONEY_CREATE', 'MONEY_UPDATE', 'MONEY_VOID', 'INVOICE_SEND',
    'PAYMENT_RECORD', 'PAYMENT_VOID', 'CREDIT_NOTE_CREATE', 'DELETE',
    'ARCHIVE', 'RESTORE', 'ROLE_CHANGE', 'TEAM_INVITE', 'TEAM_REMOVE',
    'SETTINGS_CHANGE', 'PAYOUT_EVENT', 'WEBHOOK_EVENT', 'COPILOT_ACTION',
    'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'EXPORT', 'IMPORT', 'CONSENT_CHANGE'
  ));

-- M5: append-only — UPDATE and DELETE on AuditEvent are rejected.
CREATE OR REPLACE FUNCTION audit_events_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditEvent rows are append-only: UPDATE and DELETE are not allowed';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_no_update_delete ON "AuditEvent";
CREATE TRIGGER audit_events_no_update_delete
  BEFORE UPDATE OR DELETE ON "AuditEvent"
  FOR EACH ROW EXECUTE FUNCTION audit_events_block_mutation();

-- M5: defence in depth — RLS allows only SELECT and INSERT on AuditEvent,
-- so UPDATE/DELETE are denied even if the trigger were dropped.
-- NOTE: RLS does not apply to the table owner (the app role owns its
-- tables), so the trigger above is the real enforcement; these policies
-- protect future restricted roles / read replicas.
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_events_select ON "AuditEvent";
CREATE POLICY audit_events_select ON "AuditEvent" FOR SELECT USING (true);
DROP POLICY IF EXISTS audit_events_insert ON "AuditEvent";
CREATE POLICY audit_events_insert ON "AuditEvent" FOR INSERT WITH CHECK (true);
-- No UPDATE or DELETE policy: with RLS enabled, those operations are denied.
