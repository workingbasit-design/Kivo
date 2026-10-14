-- IDEMPOTENT (2026-10-14): safe to re-run. DDL uses IF NOT EXISTS /
-- IF EXISTS guards and DO blocks; DML was already idempotent.
-- M13: TOTP two-factor authentication columns on User (Prompt 3, B7.4).
-- totpSecret holds the base32 TOTP secret ENCRYPTED at rest (AES-256-GCM
-- via src/lib/crypto.ts) - never plaintext. totpBackupCodes holds a JSON
-- array of SHA-256 hashes of single-use backup codes (hashes only, never
-- the codes). Existing users default to totpEnabled=false (opt-in), except
-- owners are required to enable it before connecting payments (enforced in
-- the Stripe Connect route, not the schema).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpBackupCodes" TEXT;

-- B7.6: business email verification before the platform sends email to the
-- business's customers. emailVerifiedAt is set when the business clicks the
-- 24h verification link sent to its sending address. (The existing
-- MessagingConnection.verifiedAt only means "connection configured".)
ALTER TABLE "MessagingConnection" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

-- Single-use email verification tokens (128-bit, SHA-256 hashed at rest).
CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationToken_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_businessId_idx" ON "EmailVerificationToken"("businessId");

-- B9.1: in-house error log (Sentry decision pending - not added). Groups
-- repeats by fingerprint; messages/stacks are PII-scrubbed before storage.
CREATE TABLE IF NOT EXISTS "ErrorLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fingerprint" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "stack" TEXT,
  "route" TEXT,
  "businessId" TEXT,
  "userId" TEXT,
  "count" INTEGER NOT NULL DEFAULT 1,
  "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ErrorLog_fingerprint_lastSeen_idx" ON "ErrorLog"("fingerprint", "lastSeen");
CREATE INDEX IF NOT EXISTS "ErrorLog_kind_lastSeen_idx" ON "ErrorLog"("kind", "lastSeen");

-- B9.2: alert dedup - one unresolved alert per key; resolved when the
-- condition clears.
CREATE TABLE IF NOT EXISTS "MonitorAlert" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "businessId" TEXT,
  "detail" TEXT NOT NULL,
  "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "MonitorAlert_key_resolvedAt_idx" ON "MonitorAlert"("key", "resolvedAt");

-- B14: record the exact consent wording version shown to the customer
-- (CASL evidence: what they agreed to, not just that they agreed).
ALTER TABLE "ConsentLog" ADD COLUMN IF NOT EXISTS "wording" TEXT;
