-- m36: customer password-reset tokens (2026-11-17, P1.0 B-6).
--
-- Customer accounts had no password-reset flow at all (the reset flow
-- under (auth) is business-only), so a customer who forgot their password
-- could never recover the account. This adds the token table mirroring
-- PasswordResetToken for business users: single-use, 1h expiry, stored
-- hashed, one live token per customer.
--
-- Safe: brand-new table, no existing rows. Idempotent: CREATE TABLE IF NOT
-- EXISTS + CREATE INDEX IF NOT EXISTS, so a re-run after a partial apply
-- - or two builds racing - converges.
CREATE TABLE IF NOT EXISTS "CustomerPasswordResetToken" (
  "id"         TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "tokenHash"  TEXT NOT NULL,
  "expiresAt"  TIMESTAMPTZ NOT NULL,
  "usedAt"     TIMESTAMPTZ,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "CustomerPasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerPasswordResetToken_tokenHash_key"
  ON "CustomerPasswordResetToken" ("tokenHash");
CREATE INDEX IF NOT EXISTS "CustomerPasswordResetToken_customerId_idx"
  ON "CustomerPasswordResetToken" ("customerId");

-- FK to CustomerUser with cascade (deleting the account deletes its tokens).
-- DO block: adding a FK after the table exists is not itself idempotent
-- across re-runs unless guarded.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CustomerPasswordResetToken_customerId_fkey'
  ) THEN
    ALTER TABLE "CustomerPasswordResetToken"
      ADD CONSTRAINT "CustomerPasswordResetToken_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "CustomerUser" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
