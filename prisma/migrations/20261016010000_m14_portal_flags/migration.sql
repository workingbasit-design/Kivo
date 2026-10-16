-- IDEMPOTENT: safe to re-run. DDL uses IF NOT EXISTS guards.
-- M14: F1 customer portal — per-business feature flags + ShareToken hardening.
-- featureFlags: JSON string like '{"portalV2": true}'. Off for existing
-- businesses; on for new businesses after launch (seed logic, not schema).

ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "featureFlags" TEXT;

-- ShareToken: view-cap + last-view tracking for portal links (F1).
ALTER TABLE "ShareToken" ADD COLUMN IF NOT EXISTS "maxViews" INTEGER;
ALTER TABLE "ShareToken" ADD COLUMN IF NOT EXISTS "lastViewedAt" TIMESTAMP(3);

-- F1: QuoteSignature — e-signature audit for portal quote acceptance.
CREATE TABLE IF NOT EXISTS "QuoteSignature" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "quoteId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "signerName" TEXT NOT NULL,
  "signerIpHash" TEXT NOT NULL,
  "userAgent" TEXT,
  "consentedAt" TIMESTAMP(3) NOT NULL,
  "acceptedOptionIds" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteSignature_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE,
  CONSTRAINT "QuoteSignature_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "QuoteSignature_quoteId_idx" ON "QuoteSignature"("quoteId");
CREATE INDEX IF NOT EXISTS "QuoteSignature_businessId_idx" ON "QuoteSignature"("businessId");

-- F1: PortalEvent — append-only audit log for portal interactions.
CREATE TABLE IF NOT EXISTS "PortalEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "shareTokenId" TEXT,
  "kind" TEXT NOT NULL,
  "customerId" TEXT,
  "meta" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE,
  CONSTRAINT "PortalEvent_shareTokenId_fkey" FOREIGN KEY ("shareTokenId") REFERENCES "ShareToken"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "PortalEvent_businessId_idx" ON "PortalEvent"("businessId");
CREATE INDEX IF NOT EXISTS "PortalEvent_shareTokenId_idx" ON "PortalEvent"("shareTokenId");

-- F1: Quote change request fields.
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "changeRequest" TEXT;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "changeRequestedAt" TIMESTAMP(3);
