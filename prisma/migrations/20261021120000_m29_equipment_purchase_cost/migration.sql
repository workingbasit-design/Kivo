-- M29 (fix D5, 2026-10-21): optional purchase cost on Equipment, so pros
-- can track what a unit cost them. Nullable and additive: existing rows
-- stay valid with NULL = "cost not recorded". Stored as integer cents,
-- the same convention as Part.unitCostCents (M8 cutover).
--
-- Idempotent (IF NOT EXISTS) like the other post-baseline migrations;
-- the Vercel build's `prisma db push` converges the column as well.

ALTER TABLE "Equipment" ADD COLUMN IF NOT EXISTS "purchaseCostCents" BIGINT;
