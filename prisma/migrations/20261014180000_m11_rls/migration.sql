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
CREATE POLICY "AgentProposal_tenant_isolation" ON "AgentProposal"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ApiKey_tenant_isolation" ON "ApiKey"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Attachment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attachment_tenant_isolation" ON "Attachment"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AuditEvent_tenant_isolation" ON "AuditEvent"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "AutomationLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AutomationLog_tenant_isolation" ON "AutomationLog"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "BookingPage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "BookingPage_tenant_isolation" ON "BookingPage"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Campaign" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Campaign_tenant_isolation" ON "Campaign"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "ChecklistTemplate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ChecklistTemplate_tenant_isolation" ON "ChecklistTemplate"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Communication" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Communication_tenant_isolation" ON "Communication"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "ConfidentialityIncident" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ConfidentialityIncident_tenant_isolation" ON "ConfidentialityIncident"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "ConsentLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ConsentLog_tenant_isolation" ON "ConsentLog"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "CreditNote" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CreditNote_tenant_isolation" ON "CreditNote"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Crew" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew_tenant_isolation" ON "Crew"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "CustomFieldDef" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CustomFieldDef_tenant_isolation" ON "CustomFieldDef"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customer_tenant_isolation" ON "Customer"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "CustomerLink" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CustomerLink_tenant_isolation" ON "CustomerLink"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "CustomerPortalToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CustomerPortalToken_tenant_isolation" ON "CustomerPortalToken"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "CustomerProperty" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CustomerProperty_tenant_isolation" ON "CustomerProperty"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Designation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Designation_tenant_isolation" ON "Designation"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "DigestSetting" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DigestSetting_tenant_isolation" ON "DigestSetting"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "DirectoryClaim" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DirectoryClaim_tenant_isolation" ON "DirectoryClaim"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "DirectoryReport" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DirectoryReport_tenant_isolation" ON "DirectoryReport"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "DocumentCounter" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DocumentCounter_tenant_isolation" ON "DocumentCounter"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Equipment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipment_tenant_isolation" ON "Equipment"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "GoogleConnection" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GoogleConnection_tenant_isolation" ON "GoogleConnection"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "IdempotencyKey" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "IdempotencyKey_tenant_isolation" ON "IdempotencyKey"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invoice_tenant_isolation" ON "Invoice"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Job_tenant_isolation" ON "Job"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "JobExpense" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "JobExpense_tenant_isolation" ON "JobExpense"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lead_tenant_isolation" ON "Lead"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membership_tenant_isolation" ON "Membership"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "MessageLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MessageLog_tenant_isolation" ON "MessageLog"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "MessageQuota" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MessageQuota_tenant_isolation" ON "MessageQuota"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "MessagingConnection" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MessagingConnection_tenant_isolation" ON "MessagingConnection"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "MessagingSettings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MessagingSettings_tenant_isolation" ON "MessagingSettings"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notification_tenant_isolation" ON "Notification"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Part" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Part_tenant_isolation" ON "Part"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payment_tenant_isolation" ON "Payment"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "PiaAuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PiaAuditLog_tenant_isolation" ON "PiaAuditLog"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project_tenant_isolation" ON "Project"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PushSubscription_tenant_isolation" ON "PushSubscription"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "QuickBooksConnection" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "QuickBooksConnection_tenant_isolation" ON "QuickBooksConnection"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "QuickBooksSyncLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "QuickBooksSyncLog_tenant_isolation" ON "QuickBooksSyncLog"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Quote" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quote_tenant_isolation" ON "Quote"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "QuoteDeposit" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "QuoteDeposit_tenant_isolation" ON "QuoteDeposit"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "QuoteRequest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "QuoteRequest_tenant_isolation" ON "QuoteRequest"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "RecurringJob" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RecurringJob_tenant_isolation" ON "RecurringJob"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Review_tenant_isolation" ON "Review"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "ReviewRequest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ReviewRequest_tenant_isolation" ON "ReviewRequest"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "SavedPro" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SavedPro_tenant_isolation" ON "SavedPro"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "SavedReport" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SavedReport_tenant_isolation" ON "SavedReport"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service_tenant_isolation" ON "Service"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "ShareToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ShareToken_tenant_isolation" ON "ShareToken"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "SignatureRequest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SignatureRequest_tenant_isolation" ON "SignatureRequest"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "StripeConnection" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "StripeConnection_tenant_isolation" ON "StripeConnection"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "StripeEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "StripeEvent_tenant_isolation" ON "StripeEvent"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "SupportTicket" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SupportTicket_tenant_isolation" ON "SupportTicket"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "TechnicianLocation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "TechnicianLocation_tenant_isolation" ON "TechnicianLocation"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "TimeEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "TimeEntry_tenant_isolation" ON "TimeEntry"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "TrackingShare" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "TrackingShare_tenant_isolation" ON "TrackingShare"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "WebhookEndpoint" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "WebhookEndpoint_tenant_isolation" ON "WebhookEndpoint"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "WebhookEvent_tenant_isolation" ON "WebhookEvent"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "WorkflowRule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "WorkflowRule_tenant_isolation" ON "WorkflowRule"
  FOR ALL
  USING ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

ALTER TABLE "InvoiceLineItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "InvoiceLineItem_tenant_isolation" ON "InvoiceLineItem"
  FOR ALL
  USING ((SELECT "businessId" FROM "Invoice" WHERE "Invoice"."id" = "InvoiceLineItem"."invoiceId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Invoice" WHERE "Invoice"."id" = "InvoiceLineItem"."invoiceId") = current_setting('app.business_id', true));

ALTER TABLE "InvoiceTaxLine" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "InvoiceTaxLine_tenant_isolation" ON "InvoiceTaxLine"
  FOR ALL
  USING ((SELECT "businessId" FROM "Invoice" WHERE "Invoice"."id" = "InvoiceTaxLine"."invoiceId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Invoice" WHERE "Invoice"."id" = "InvoiceTaxLine"."invoiceId") = current_setting('app.business_id', true));

ALTER TABLE "QuoteLineItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "QuoteLineItem_tenant_isolation" ON "QuoteLineItem"
  FOR ALL
  USING ((SELECT "businessId" FROM "Quote" WHERE "Quote"."id" = "QuoteLineItem"."quoteId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Quote" WHERE "Quote"."id" = "QuoteLineItem"."quoteId") = current_setting('app.business_id', true));

ALTER TABLE "QuoteAddon" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "QuoteAddon_tenant_isolation" ON "QuoteAddon"
  FOR ALL
  USING ((SELECT "businessId" FROM "Quote" WHERE "Quote"."id" = "QuoteAddon"."quoteId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Quote" WHERE "Quote"."id" = "QuoteAddon"."quoteId") = current_setting('app.business_id', true));

ALTER TABLE "JobNote" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "JobNote_tenant_isolation" ON "JobNote"
  FOR ALL
  USING ((SELECT "businessId" FROM "Job" WHERE "Job"."id" = "JobNote"."jobId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Job" WHERE "Job"."id" = "JobNote"."jobId") = current_setting('app.business_id', true));

ALTER TABLE "JobPhoto" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "JobPhoto_tenant_isolation" ON "JobPhoto"
  FOR ALL
  USING ((SELECT "businessId" FROM "Job" WHERE "Job"."id" = "JobPhoto"."jobId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Job" WHERE "Job"."id" = "JobPhoto"."jobId") = current_setting('app.business_id', true));

ALTER TABLE "JobChecklistItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "JobChecklistItem_tenant_isolation" ON "JobChecklistItem"
  FOR ALL
  USING ((SELECT "businessId" FROM "Job" WHERE "Job"."id" = "JobChecklistItem"."jobId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Job" WHERE "Job"."id" = "JobChecklistItem"."jobId") = current_setting('app.business_id', true));

ALTER TABLE "ChecklistTemplateItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ChecklistTemplateItem_tenant_isolation" ON "ChecklistTemplateItem"
  FOR ALL
  USING ((SELECT "businessId" FROM "ChecklistTemplate" WHERE "ChecklistTemplate"."id" = "ChecklistTemplateItem"."templateId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "ChecklistTemplate" WHERE "ChecklistTemplate"."id" = "ChecklistTemplateItem"."templateId") = current_setting('app.business_id', true));

ALTER TABLE "CrewMember" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CrewMember_tenant_isolation" ON "CrewMember"
  FOR ALL
  USING ((SELECT "businessId" FROM "Crew" WHERE "Crew"."id" = "CrewMember"."crewId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Crew" WHERE "Crew"."id" = "CrewMember"."crewId") = current_setting('app.business_id', true));

ALTER TABLE "WorkflowEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "WorkflowEvent_tenant_isolation" ON "WorkflowEvent"
  FOR ALL
  USING ((SELECT "businessId" FROM "WorkflowRule" WHERE "WorkflowRule"."id" = "WorkflowEvent"."ruleId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "WorkflowRule" WHERE "WorkflowRule"."id" = "WorkflowEvent"."ruleId") = current_setting('app.business_id', true));

ALTER TABLE "WebhookDelivery" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "WebhookDelivery_tenant_isolation" ON "WebhookDelivery"
  FOR ALL
  USING ((SELECT "businessId" FROM "WebhookEndpoint" WHERE "WebhookEndpoint"."id" = "WebhookDelivery"."endpointId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "WebhookEndpoint" WHERE "WebhookEndpoint"."id" = "WebhookDelivery"."endpointId") = current_setting('app.business_id', true));

ALTER TABLE "CustomerFieldValue" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CustomerFieldValue_tenant_isolation" ON "CustomerFieldValue"
  FOR ALL
  USING ((SELECT "businessId" FROM "CustomFieldDef" WHERE "CustomFieldDef"."id" = "CustomerFieldValue"."fieldId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "CustomFieldDef" WHERE "CustomFieldDef"."id" = "CustomerFieldValue"."fieldId") = current_setting('app.business_id', true));

ALTER TABLE "QuoteMessage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "QuoteMessage_tenant_isolation" ON "QuoteMessage"
  FOR ALL
  USING ((SELECT "businessId" FROM "QuoteRequest" WHERE "QuoteRequest"."id" = "QuoteMessage"."quoteRequestId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "QuoteRequest" WHERE "QuoteRequest"."id" = "QuoteMessage"."quoteRequestId") = current_setting('app.business_id', true));

ALTER TABLE "ProjectPhase" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ProjectPhase_tenant_isolation" ON "ProjectPhase"
  FOR ALL
  USING ((SELECT "businessId" FROM "Project" WHERE "Project"."id" = "ProjectPhase"."projectId") = current_setting('app.business_id', true))
  WITH CHECK ((SELECT "businessId" FROM "Project" WHERE "Project"."id" = "ProjectPhase"."projectId") = current_setting('app.business_id', true));

ALTER TABLE "ConciergeSend" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ConciergeSend_tenant_isolation" ON "ConciergeSend"
  FOR ALL
  USING (current_setting('app.business_id', true) = ANY("businessIds"))
  WITH CHECK (current_setting('app.business_id', true) = ANY("businessIds"));
