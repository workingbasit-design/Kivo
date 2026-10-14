-- IDEMPOTENT (2026-10-14): safe to re-run. DDL uses IF NOT EXISTS /
-- IF EXISTS guards and DO blocks; DML was already idempotent.
-- M11: RLS policies (STAGED — created but NOT enforced).
--
-- WHAT THIS DOES: creates one tenant-isolation policy per business table:
--   USING ("businessId" = current_setting('app.business_id', true))
--   WITH CHECK (same)   -- for INSERT/UPDATE
-- Child tables without their own businessId get the policy via their parent
-- (e.g. InvoiceLineItem via Invoice.businessId).
--
-- WHAT THIS DOES *NOT* DO (deliberate, see docs/SECURITY_REPORT.md):
-- - The policies are NOT FORCEd. The app connects as the table owner, and
--   table owners bypass RLS unless FORCE ROW LEVEL SECURITY is set — so with
--   the app's connection nothing changes (verified: full test suite green
--   with the policies in place). Enforcement is a separate activation step.
-- - The app is NOT yet wired to run set_config('app.business_id', ...) per
--   request/transaction. Until that wiring + a staging verification pass
--   exist, enabling FORCE would break the app fail-closed. Do NOT add FORCE
--   without completing the activation checklist in docs/SECURITY_REPORT.md.
-- - Until activation, the active defence stays Line 1 of the plan:
--   src/lib/tenant-guard.ts (fail-closed middleware) + the TENANT_MODELS
--   sync test in src/lib/__tests__/tenant-isolation.test.mts.
--
-- Tables intentionally WITHOUT a policy (documented):
--   User, Session, PasswordResetToken, CustomerUser, CustomerSession,
--   CustomerAgentKey — identity roots (auth code path only, cf. tenant-guard).
--   Business — the tenant root itself; the public directory legitimately
--     reads other businesses' rows.
--   TaxRate — global seed data, identical for every tenant.
--   RateLimit — operational counters, no tenant data.
--   DirectoryRequest — public form submissions (may have null business).
-- New business tables MUST add the two statements below (ENABLE + CREATE
-- POLICY); the rls.test.mts "policy rollout" test fails if one is missing.

ALTER TABLE "AgentProposal" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AgentProposal_tenant_isolation" ON "AgentProposal";
CREATE POLICY "AgentProposal_tenant_isolation" ON "AgentProposal"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ApiKey_tenant_isolation" ON "ApiKey";
CREATE POLICY "ApiKey_tenant_isolation" ON "ApiKey"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Attachment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Attachment_tenant_isolation" ON "Attachment";
CREATE POLICY "Attachment_tenant_isolation" ON "Attachment"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AuditEvent_tenant_isolation" ON "AuditEvent";
CREATE POLICY "AuditEvent_tenant_isolation" ON "AuditEvent"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "AutomationLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AutomationLog_tenant_isolation" ON "AutomationLog";
CREATE POLICY "AutomationLog_tenant_isolation" ON "AutomationLog"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "BookingPage" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BookingPage_tenant_isolation" ON "BookingPage";
CREATE POLICY "BookingPage_tenant_isolation" ON "BookingPage"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Campaign" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Campaign_tenant_isolation" ON "Campaign";
CREATE POLICY "Campaign_tenant_isolation" ON "Campaign"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "ChecklistTemplate" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ChecklistTemplate_tenant_isolation" ON "ChecklistTemplate";
CREATE POLICY "ChecklistTemplate_tenant_isolation" ON "ChecklistTemplate"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Communication" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Communication_tenant_isolation" ON "Communication";
CREATE POLICY "Communication_tenant_isolation" ON "Communication"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "ConfidentialityIncident" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ConfidentialityIncident_tenant_isolation" ON "ConfidentialityIncident";
CREATE POLICY "ConfidentialityIncident_tenant_isolation" ON "ConfidentialityIncident"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "ConsentLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ConsentLog_tenant_isolation" ON "ConsentLog";
CREATE POLICY "ConsentLog_tenant_isolation" ON "ConsentLog"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "CreditNote" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CreditNote_tenant_isolation" ON "CreditNote";
CREATE POLICY "CreditNote_tenant_isolation" ON "CreditNote"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Crew" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Crew_tenant_isolation" ON "Crew";
CREATE POLICY "Crew_tenant_isolation" ON "Crew"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "CustomFieldDef" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CustomFieldDef_tenant_isolation" ON "CustomFieldDef";
CREATE POLICY "CustomFieldDef_tenant_isolation" ON "CustomFieldDef"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Customer_tenant_isolation" ON "Customer";
CREATE POLICY "Customer_tenant_isolation" ON "Customer"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "CustomerLink" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CustomerLink_tenant_isolation" ON "CustomerLink";
CREATE POLICY "CustomerLink_tenant_isolation" ON "CustomerLink"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "CustomerPortalToken" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CustomerPortalToken_tenant_isolation" ON "CustomerPortalToken";
CREATE POLICY "CustomerPortalToken_tenant_isolation" ON "CustomerPortalToken"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "CustomerProperty" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CustomerProperty_tenant_isolation" ON "CustomerProperty";
CREATE POLICY "CustomerProperty_tenant_isolation" ON "CustomerProperty"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Designation" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Designation_tenant_isolation" ON "Designation";
CREATE POLICY "Designation_tenant_isolation" ON "Designation"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "DigestSetting" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DigestSetting_tenant_isolation" ON "DigestSetting";
CREATE POLICY "DigestSetting_tenant_isolation" ON "DigestSetting"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "DirectoryClaim" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DirectoryClaim_tenant_isolation" ON "DirectoryClaim";
CREATE POLICY "DirectoryClaim_tenant_isolation" ON "DirectoryClaim"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "DirectoryReport" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DirectoryReport_tenant_isolation" ON "DirectoryReport";
CREATE POLICY "DirectoryReport_tenant_isolation" ON "DirectoryReport"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "DocumentCounter" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DocumentCounter_tenant_isolation" ON "DocumentCounter";
CREATE POLICY "DocumentCounter_tenant_isolation" ON "DocumentCounter"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Equipment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipment_tenant_isolation" ON "Equipment";
CREATE POLICY "Equipment_tenant_isolation" ON "Equipment"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "GoogleConnection" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "GoogleConnection_tenant_isolation" ON "GoogleConnection";
CREATE POLICY "GoogleConnection_tenant_isolation" ON "GoogleConnection"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "IdempotencyKey" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "IdempotencyKey_tenant_isolation" ON "IdempotencyKey";
CREATE POLICY "IdempotencyKey_tenant_isolation" ON "IdempotencyKey"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Invoice_tenant_isolation" ON "Invoice";
CREATE POLICY "Invoice_tenant_isolation" ON "Invoice"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Job_tenant_isolation" ON "Job";
CREATE POLICY "Job_tenant_isolation" ON "Job"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "JobExpense" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JobExpense_tenant_isolation" ON "JobExpense";
CREATE POLICY "JobExpense_tenant_isolation" ON "JobExpense"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lead_tenant_isolation" ON "Lead";
CREATE POLICY "Lead_tenant_isolation" ON "Lead"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Membership_tenant_isolation" ON "Membership";
CREATE POLICY "Membership_tenant_isolation" ON "Membership"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "MessageLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "MessageLog_tenant_isolation" ON "MessageLog";
CREATE POLICY "MessageLog_tenant_isolation" ON "MessageLog"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "MessageQuota" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "MessageQuota_tenant_isolation" ON "MessageQuota";
CREATE POLICY "MessageQuota_tenant_isolation" ON "MessageQuota"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "MessagingConnection" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "MessagingConnection_tenant_isolation" ON "MessagingConnection";
CREATE POLICY "MessagingConnection_tenant_isolation" ON "MessagingConnection"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "MessagingSettings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "MessagingSettings_tenant_isolation" ON "MessagingSettings";
CREATE POLICY "MessagingSettings_tenant_isolation" ON "MessagingSettings"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notification_tenant_isolation" ON "Notification";
CREATE POLICY "Notification_tenant_isolation" ON "Notification"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Part" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Part_tenant_isolation" ON "Part";
CREATE POLICY "Part_tenant_isolation" ON "Part"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Payment_tenant_isolation" ON "Payment";
CREATE POLICY "Payment_tenant_isolation" ON "Payment"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "PiaAuditLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PiaAuditLog_tenant_isolation" ON "PiaAuditLog";
CREATE POLICY "PiaAuditLog_tenant_isolation" ON "PiaAuditLog"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Project_tenant_isolation" ON "Project";
CREATE POLICY "Project_tenant_isolation" ON "Project"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PushSubscription_tenant_isolation" ON "PushSubscription";
CREATE POLICY "PushSubscription_tenant_isolation" ON "PushSubscription"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "QuickBooksConnection" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "QuickBooksConnection_tenant_isolation" ON "QuickBooksConnection";
CREATE POLICY "QuickBooksConnection_tenant_isolation" ON "QuickBooksConnection"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "QuickBooksSyncLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "QuickBooksSyncLog_tenant_isolation" ON "QuickBooksSyncLog";
CREATE POLICY "QuickBooksSyncLog_tenant_isolation" ON "QuickBooksSyncLog"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Quote" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Quote_tenant_isolation" ON "Quote";
CREATE POLICY "Quote_tenant_isolation" ON "Quote"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "QuoteDeposit" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "QuoteDeposit_tenant_isolation" ON "QuoteDeposit";
CREATE POLICY "QuoteDeposit_tenant_isolation" ON "QuoteDeposit"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "QuoteRequest" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "QuoteRequest_tenant_isolation" ON "QuoteRequest";
CREATE POLICY "QuoteRequest_tenant_isolation" ON "QuoteRequest"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "RecurringJob" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RecurringJob_tenant_isolation" ON "RecurringJob";
CREATE POLICY "RecurringJob_tenant_isolation" ON "RecurringJob"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Review_tenant_isolation" ON "Review";
CREATE POLICY "Review_tenant_isolation" ON "Review"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "ReviewRequest" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ReviewRequest_tenant_isolation" ON "ReviewRequest";
CREATE POLICY "ReviewRequest_tenant_isolation" ON "ReviewRequest"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "SavedPro" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SavedPro_tenant_isolation" ON "SavedPro";
CREATE POLICY "SavedPro_tenant_isolation" ON "SavedPro"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "SavedReport" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SavedReport_tenant_isolation" ON "SavedReport";
CREATE POLICY "SavedReport_tenant_isolation" ON "SavedReport"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service_tenant_isolation" ON "Service";
CREATE POLICY "Service_tenant_isolation" ON "Service"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "ShareToken" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ShareToken_tenant_isolation" ON "ShareToken";
CREATE POLICY "ShareToken_tenant_isolation" ON "ShareToken"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "SignatureRequest" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SignatureRequest_tenant_isolation" ON "SignatureRequest";
CREATE POLICY "SignatureRequest_tenant_isolation" ON "SignatureRequest"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "StripeConnection" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "StripeConnection_tenant_isolation" ON "StripeConnection";
CREATE POLICY "StripeConnection_tenant_isolation" ON "StripeConnection"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "StripeEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "StripeEvent_tenant_isolation" ON "StripeEvent";
CREATE POLICY "StripeEvent_tenant_isolation" ON "StripeEvent"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "SupportTicket" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SupportTicket_tenant_isolation" ON "SupportTicket";
CREATE POLICY "SupportTicket_tenant_isolation" ON "SupportTicket"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "TechnicianLocation" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "TechnicianLocation_tenant_isolation" ON "TechnicianLocation";
CREATE POLICY "TechnicianLocation_tenant_isolation" ON "TechnicianLocation"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "TimeEntry" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "TimeEntry_tenant_isolation" ON "TimeEntry";
CREATE POLICY "TimeEntry_tenant_isolation" ON "TimeEntry"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "TrackingShare" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "TrackingShare_tenant_isolation" ON "TrackingShare";
CREATE POLICY "TrackingShare_tenant_isolation" ON "TrackingShare"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "WebhookEndpoint" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WebhookEndpoint_tenant_isolation" ON "WebhookEndpoint";
CREATE POLICY "WebhookEndpoint_tenant_isolation" ON "WebhookEndpoint"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WebhookEvent_tenant_isolation" ON "WebhookEvent";
CREATE POLICY "WebhookEvent_tenant_isolation" ON "WebhookEvent"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "WorkflowRule" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowRule_tenant_isolation" ON "WorkflowRule";
CREATE POLICY "WorkflowRule_tenant_isolation" ON "WorkflowRule"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "InvoiceLineItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "InvoiceLineItem_tenant_isolation" ON "InvoiceLineItem";
CREATE POLICY "InvoiceLineItem_tenant_isolation" ON "InvoiceLineItem"
  FOR ALL
  USING ((SELECT "businessId" FROM "Invoice" WHERE "Invoice"."id" = "InvoiceLineItem"."invoiceId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Invoice" WHERE "Invoice"."id" = "InvoiceLineItem"."invoiceId") = current_setting('app.business_id', true));

ALTER TABLE "InvoiceTaxLine" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "InvoiceTaxLine_tenant_isolation" ON "InvoiceTaxLine";
CREATE POLICY "InvoiceTaxLine_tenant_isolation" ON "InvoiceTaxLine"
  FOR ALL
  USING ((SELECT "businessId" FROM "Invoice" WHERE "Invoice"."id" = "InvoiceTaxLine"."invoiceId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Invoice" WHERE "Invoice"."id" = "InvoiceTaxLine"."invoiceId") = current_setting('app.business_id', true));

ALTER TABLE "QuoteLineItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "QuoteLineItem_tenant_isolation" ON "QuoteLineItem";
CREATE POLICY "QuoteLineItem_tenant_isolation" ON "QuoteLineItem"
  FOR ALL
  USING ((SELECT "businessId" FROM "Quote" WHERE "Quote"."id" = "QuoteLineItem"."quoteId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Quote" WHERE "Quote"."id" = "QuoteLineItem"."quoteId") = current_setting('app.business_id', true));

ALTER TABLE "QuoteAddon" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "QuoteAddon_tenant_isolation" ON "QuoteAddon";
CREATE POLICY "QuoteAddon_tenant_isolation" ON "QuoteAddon"
  FOR ALL
  USING ((SELECT "businessId" FROM "Quote" WHERE "Quote"."id" = "QuoteAddon"."quoteId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Quote" WHERE "Quote"."id" = "QuoteAddon"."quoteId") = current_setting('app.business_id', true));

ALTER TABLE "JobNote" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JobNote_tenant_isolation" ON "JobNote";
CREATE POLICY "JobNote_tenant_isolation" ON "JobNote"
  FOR ALL
  USING ((SELECT "businessId" FROM "Job" WHERE "Job"."id" = "JobNote"."jobId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Job" WHERE "Job"."id" = "JobNote"."jobId") = current_setting('app.business_id', true));

ALTER TABLE "JobPhoto" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JobPhoto_tenant_isolation" ON "JobPhoto";
CREATE POLICY "JobPhoto_tenant_isolation" ON "JobPhoto"
  FOR ALL
  USING ((SELECT "businessId" FROM "Job" WHERE "Job"."id" = "JobPhoto"."jobId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Job" WHERE "Job"."id" = "JobPhoto"."jobId") = current_setting('app.business_id', true));

ALTER TABLE "JobChecklistItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JobChecklistItem_tenant_isolation" ON "JobChecklistItem";
CREATE POLICY "JobChecklistItem_tenant_isolation" ON "JobChecklistItem"
  FOR ALL
  USING ((SELECT "businessId" FROM "Job" WHERE "Job"."id" = "JobChecklistItem"."jobId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Job" WHERE "Job"."id" = "JobChecklistItem"."jobId") = current_setting('app.business_id', true));

ALTER TABLE "ChecklistTemplateItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ChecklistTemplateItem_tenant_isolation" ON "ChecklistTemplateItem";
CREATE POLICY "ChecklistTemplateItem_tenant_isolation" ON "ChecklistTemplateItem"
  FOR ALL
  USING ((SELECT "businessId" FROM "ChecklistTemplate" WHERE "ChecklistTemplate"."id" = "ChecklistTemplateItem"."templateId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "ChecklistTemplate" WHERE "ChecklistTemplate"."id" = "ChecklistTemplateItem"."templateId") = current_setting('app.business_id', true));

ALTER TABLE "CrewMember" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CrewMember_tenant_isolation" ON "CrewMember";
CREATE POLICY "CrewMember_tenant_isolation" ON "CrewMember"
  FOR ALL
  USING ((SELECT "businessId" FROM "Crew" WHERE "Crew"."id" = "CrewMember"."crewId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Crew" WHERE "Crew"."id" = "CrewMember"."crewId") = current_setting('app.business_id', true));

ALTER TABLE "WorkflowEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WorkflowEvent_tenant_isolation" ON "WorkflowEvent";
CREATE POLICY "WorkflowEvent_tenant_isolation" ON "WorkflowEvent"
  FOR ALL
  USING ((SELECT "businessId" FROM "WorkflowRule" WHERE "WorkflowRule"."id" = "WorkflowEvent"."ruleId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "WorkflowRule" WHERE "WorkflowRule"."id" = "WorkflowEvent"."ruleId") = current_setting('app.business_id', true));

ALTER TABLE "WebhookDelivery" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WebhookDelivery_tenant_isolation" ON "WebhookDelivery";
CREATE POLICY "WebhookDelivery_tenant_isolation" ON "WebhookDelivery"
  FOR ALL
  USING ((SELECT "businessId" FROM "WebhookEndpoint" WHERE "WebhookEndpoint"."id" = "WebhookDelivery"."endpointId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "WebhookEndpoint" WHERE "WebhookEndpoint"."id" = "WebhookDelivery"."endpointId") = current_setting('app.business_id', true));

ALTER TABLE "CustomerFieldValue" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CustomerFieldValue_tenant_isolation" ON "CustomerFieldValue";
CREATE POLICY "CustomerFieldValue_tenant_isolation" ON "CustomerFieldValue"
  FOR ALL
  USING ((SELECT "businessId" FROM "CustomFieldDef" WHERE "CustomFieldDef"."id" = "CustomerFieldValue"."fieldId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "CustomFieldDef" WHERE "CustomFieldDef"."id" = "CustomerFieldValue"."fieldId") = current_setting('app.business_id', true));

ALTER TABLE "QuoteMessage" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "QuoteMessage_tenant_isolation" ON "QuoteMessage";
CREATE POLICY "QuoteMessage_tenant_isolation" ON "QuoteMessage"
  FOR ALL
  USING ((SELECT "businessId" FROM "QuoteRequest" WHERE "QuoteRequest"."id" = "QuoteMessage"."quoteRequestId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "QuoteRequest" WHERE "QuoteRequest"."id" = "QuoteMessage"."quoteRequestId") = current_setting('app.business_id', true));

ALTER TABLE "ProjectPhase" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ProjectPhase_tenant_isolation" ON "ProjectPhase";
CREATE POLICY "ProjectPhase_tenant_isolation" ON "ProjectPhase"
  FOR ALL
  USING ((SELECT "businessId" FROM "Project" WHERE "Project"."id" = "ProjectPhase"."projectId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Project" WHERE "Project"."id" = "ProjectPhase"."projectId") = current_setting('app.business_id', true));

ALTER TABLE "ConciergeSend" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ConciergeSend_tenant_isolation" ON "ConciergeSend";
CREATE POLICY "ConciergeSend_tenant_isolation" ON "ConciergeSend"
  FOR ALL
  USING (current_setting('app.business_id', true) = ANY("businessIds"))
  WITH CHECK (current_setting('app.business_id', true) = ANY("businessIds"));
