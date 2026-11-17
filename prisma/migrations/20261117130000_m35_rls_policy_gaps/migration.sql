-- IDEMPOTENT (2026-11-17): safe to re-run. DDL uses IF NOT EXISTS /
-- IF EXISTS guards (DROP POLICY IF EXISTS + CREATE POLICY); re-running a
-- fully-applied file is all no-ops. Fix forward, never blindly.
-- M35: RLS policy gaps (P1.0 Stage 1, audit slice A §2).
--
-- WHAT THIS DOES:
-- (a) Adds the missing tenant-isolation policy to the 13 business tables
--     created after M11 (2026-10-14 18:00) that never got one:
--     BookableService, BookingRequest, JobAssignment, VisitSignature,
--     MessageTemplateOverride, DashboardLayout, EmailVerificationToken,
--     ErrorLog, MonitorAlert, PortalEvent, QuoteSignature, QuoteTemplate,
--     Subcontractor. Pattern of the gap: every business table added after
--     M11 missed its policy because nothing enforced the migration
--     header's "new business tables MUST add the two statements" rule.
--     The rls.test.mts coverage test now generates its expected list from
--     schema.prisma, so this gap cannot recur silently.
-- (b) Adds the 4 missing parent-linked child policies:
--     QuoteTemplateItem (via QuoteTemplate), JobFieldValue (via Job AND
--     CustomFieldDef), PropertyFieldValue (via CustomerProperty AND
--     CustomFieldDef), JobSubcontractor (via Job).
-- (c) Tightens CustomerFieldValue: its M11 policy resolved the tenant via
--     the CustomFieldDef only, so a value row whose field belonged to
--     business A but whose customer belonged to business B was visible to
--     A. It now requires BOTH the field's business AND the customer's
--     business to equal the setting.
-- (d) Carves out NULL businessId rows on the 6 nullable-businessId models
--     (ErrorLog, MonitorAlert — new here; IdempotencyKey, SupportTicket,
--     WebhookEvent, ConfidentialityIncident — M11 policies rewritten):
--     plain equality evaluates to NULL (→ invisible) for null-business
--     rows, so under a future FORCE those platform / pre-auth rows
--     (pre-auth idempotency replays, public support tickets, platform
--     incidents, global error/alert rows) would silently vanish. The
--     carve-out is `OR "businessId" IS NULL` in both USING and WITH
--     CHECK. Writes of null rows stay app-controlled (businessId is
--     server-determined in every write path); no tenant input can choose
--     businessId NULL.
--
-- WHAT THIS DOES *NOT* DO (deliberate, same as M11):
-- - The policies are NOT FORCEd. The app connects as the table owner,
--   and table owners bypass RLS unless FORCE ROW LEVEL SECURITY is set.
-- - The app is NOT yet wired to run set_config('app.business_id', ...)
--   per request/transaction. Do NOT add FORCE without completing the
--   activation checklist in docs/SECURITY_REPORT.md (Stage 2 validation
--   on a scratch DB first, then staged enforcement).
-- - Until activation, the active defence stays Line 1:
--   src/lib/tenant-guard.ts (fail-closed middleware) + the TENANT_MODELS
--   sync test in src/lib/__tests__/tenant-isolation.test.mts.

-- (a) Business tables with REQUIRED businessId: plain equality (M11 pattern).

ALTER TABLE "BookableService" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BookableService_tenant_isolation" ON "BookableService";
CREATE POLICY "BookableService_tenant_isolation" ON "BookableService"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "BookingRequest" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BookingRequest_tenant_isolation" ON "BookingRequest";
CREATE POLICY "BookingRequest_tenant_isolation" ON "BookingRequest"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "JobAssignment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JobAssignment_tenant_isolation" ON "JobAssignment";
CREATE POLICY "JobAssignment_tenant_isolation" ON "JobAssignment"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "VisitSignature" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "VisitSignature_tenant_isolation" ON "VisitSignature";
CREATE POLICY "VisitSignature_tenant_isolation" ON "VisitSignature"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "MessageTemplateOverride" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "MessageTemplateOverride_tenant_isolation" ON "MessageTemplateOverride";
CREATE POLICY "MessageTemplateOverride_tenant_isolation" ON "MessageTemplateOverride"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "DashboardLayout" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DashboardLayout_tenant_isolation" ON "DashboardLayout";
CREATE POLICY "DashboardLayout_tenant_isolation" ON "DashboardLayout"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "EmailVerificationToken" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "EmailVerificationToken_tenant_isolation" ON "EmailVerificationToken";
CREATE POLICY "EmailVerificationToken_tenant_isolation" ON "EmailVerificationToken"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "PortalEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PortalEvent_tenant_isolation" ON "PortalEvent";
CREATE POLICY "PortalEvent_tenant_isolation" ON "PortalEvent"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "QuoteSignature" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "QuoteSignature_tenant_isolation" ON "QuoteSignature";
CREATE POLICY "QuoteSignature_tenant_isolation" ON "QuoteSignature"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "QuoteTemplate" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "QuoteTemplate_tenant_isolation" ON "QuoteTemplate";
CREATE POLICY "QuoteTemplate_tenant_isolation" ON "QuoteTemplate"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Subcontractor" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Subcontractor_tenant_isolation" ON "Subcontractor";
CREATE POLICY "Subcontractor_tenant_isolation" ON "Subcontractor"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

-- (a) Business tables with NULLABLE businessId: equality OR IS NULL, so
-- platform rows (businessId NULL by design) do not vanish under FORCE.

ALTER TABLE "ErrorLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ErrorLog_tenant_isolation" ON "ErrorLog";
CREATE POLICY "ErrorLog_tenant_isolation" ON "ErrorLog"
  FOR ALL
  USING (("businessId" = current_setting('app.business_id', true)) OR ("businessId" IS NULL))
  WITH CHECK (("businessId" = current_setting('app.business_id', true)) OR ("businessId" IS NULL));

ALTER TABLE "MonitorAlert" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "MonitorAlert_tenant_isolation" ON "MonitorAlert";
CREATE POLICY "MonitorAlert_tenant_isolation" ON "MonitorAlert"
  FOR ALL
  USING (("businessId" = current_setting('app.business_id', true)) OR ("businessId" IS NULL))
  WITH CHECK (("businessId" = current_setting('app.business_id', true)) OR ("businessId" IS NULL));

-- (b) Parent-linked child tables (no businessId column of their own).

ALTER TABLE "QuoteTemplateItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "QuoteTemplateItem_tenant_isolation" ON "QuoteTemplateItem";
CREATE POLICY "QuoteTemplateItem_tenant_isolation" ON "QuoteTemplateItem"
  FOR ALL
  USING ((SELECT "businessId" FROM "QuoteTemplate" WHERE "QuoteTemplate"."id" = "QuoteTemplateItem"."templateId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "QuoteTemplate" WHERE "QuoteTemplate"."id" = "QuoteTemplateItem"."templateId") = current_setting('app.business_id', true));

-- JobFieldValue resolves via the JOB (not only via the def): a value row
-- whose field belonged to business A but whose job belonged to business B
-- must not be visible to A. Both must match, mirroring the app-code check
-- in custom-fields.ts (job AND def verified before set).
ALTER TABLE "JobFieldValue" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JobFieldValue_tenant_isolation" ON "JobFieldValue";
CREATE POLICY "JobFieldValue_tenant_isolation" ON "JobFieldValue"
  FOR ALL
  USING (
    (SELECT "businessId" FROM "Job" WHERE "Job"."id" = "JobFieldValue"."jobId") = current_setting('app.business_id', true)
    AND (SELECT "businessId" FROM "CustomFieldDef" WHERE "CustomFieldDef"."id" = "JobFieldValue"."fieldId") = current_setting('app.business_id', true)
  )
  WITH CHECK (
    (SELECT "businessId" FROM "Job" WHERE "Job"."id" = "JobFieldValue"."jobId") = current_setting('app.business_id', true)
    AND (SELECT "businessId" FROM "CustomFieldDef" WHERE "CustomFieldDef"."id" = "JobFieldValue"."fieldId") = current_setting('app.business_id', true)
  );

ALTER TABLE "PropertyFieldValue" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PropertyFieldValue_tenant_isolation" ON "PropertyFieldValue";
CREATE POLICY "PropertyFieldValue_tenant_isolation" ON "PropertyFieldValue"
  FOR ALL
  USING (
    (SELECT "businessId" FROM "CustomerProperty" WHERE "CustomerProperty"."id" = "PropertyFieldValue"."propertyId") = current_setting('app.business_id', true)
    AND (SELECT "businessId" FROM "CustomFieldDef" WHERE "CustomFieldDef"."id" = "PropertyFieldValue"."fieldId") = current_setting('app.business_id', true)
  )
  WITH CHECK (
    (SELECT "businessId" FROM "CustomerProperty" WHERE "CustomerProperty"."id" = "PropertyFieldValue"."propertyId") = current_setting('app.business_id', true)
    AND (SELECT "businessId" FROM "CustomFieldDef" WHERE "CustomFieldDef"."id" = "PropertyFieldValue"."fieldId") = current_setting('app.business_id', true)
  );

ALTER TABLE "JobSubcontractor" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JobSubcontractor_tenant_isolation" ON "JobSubcontractor";
CREATE POLICY "JobSubcontractor_tenant_isolation" ON "JobSubcontractor"
  FOR ALL
  USING ((SELECT "businessId" FROM "Job" WHERE "Job"."id" = "JobSubcontractor"."jobId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Job" WHERE "Job"."id" = "JobSubcontractor"."jobId") = current_setting('app.business_id', true));

-- (c) Tighten CustomerFieldValue: require BOTH the field's business AND
-- the customer's business to equal the setting (M11 resolved via the def
-- only — see the §2.2 caveat in slice A).

DROP POLICY IF EXISTS "CustomerFieldValue_tenant_isolation" ON "CustomerFieldValue";
CREATE POLICY "CustomerFieldValue_tenant_isolation" ON "CustomerFieldValue"
  FOR ALL
  USING (
    (SELECT "businessId" FROM "CustomFieldDef" WHERE "CustomFieldDef"."id" = "CustomerFieldValue"."fieldId") = current_setting('app.business_id', true)
    AND (SELECT "businessId" FROM "Customer" WHERE "Customer"."id" = "CustomerFieldValue"."customerId") = current_setting('app.business_id', true)
  )
  WITH CHECK (
    (SELECT "businessId" FROM "CustomFieldDef" WHERE "CustomFieldDef"."id" = "CustomerFieldValue"."fieldId") = current_setting('app.business_id', true)
    AND (SELECT "businessId" FROM "Customer" WHERE "Customer"."id" = "CustomerFieldValue"."customerId") = current_setting('app.business_id', true)
  );

-- (d) NULL carve-outs on the M11 policies for the other nullable-businessId
-- models (same rationale as (a) above).

DROP POLICY IF EXISTS "IdempotencyKey_tenant_isolation" ON "IdempotencyKey";
CREATE POLICY "IdempotencyKey_tenant_isolation" ON "IdempotencyKey"
  FOR ALL
  USING (("businessId" = current_setting('app.business_id', true)) OR ("businessId" IS NULL))
  WITH CHECK (("businessId" = current_setting('app.business_id', true)) OR ("businessId" IS NULL));

DROP POLICY IF EXISTS "SupportTicket_tenant_isolation" ON "SupportTicket";
CREATE POLICY "SupportTicket_tenant_isolation" ON "SupportTicket"
  FOR ALL
  USING (("businessId" = current_setting('app.business_id', true)) OR ("businessId" IS NULL))
  WITH CHECK (("businessId" = current_setting('app.business_id', true)) OR ("businessId" IS NULL));

DROP POLICY IF EXISTS "WebhookEvent_tenant_isolation" ON "WebhookEvent";
CREATE POLICY "WebhookEvent_tenant_isolation" ON "WebhookEvent"
  FOR ALL
  USING (("businessId" = current_setting('app.business_id', true)) OR ("businessId" IS NULL))
  WITH CHECK (("businessId" = current_setting('app.business_id', true)) OR ("businessId" IS NULL));

DROP POLICY IF EXISTS "ConfidentialityIncident_tenant_isolation" ON "ConfidentialityIncident";
CREATE POLICY "ConfidentialityIncident_tenant_isolation" ON "ConfidentialityIncident"
  FOR ALL
  USING (("businessId" = current_setting('app.business_id', true)) OR ("businessId" IS NULL))
  WITH CHECK (("businessId" = current_setting('app.business_id', true)) OR ("businessId" IS NULL));
