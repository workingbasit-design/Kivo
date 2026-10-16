-- M23 (C1): Add bankFirstAboveCents to StripeConnection for "Pay by bank" hint.

ALTER TABLE "StripeConnection" ADD COLUMN IF NOT EXISTS "bankFirstAboveCents" BIGINT;
