-- Part B (dashboard rebuild): owner-editable trade icon per price-book service.
-- Service.iconKey stores one of the TRADE_KEYS from src/lib/trade-icons.ts
-- (cleaning, gutters, furnace, windows, plumbing, electrical, landscaping,
-- snow, painting, general). NULL = auto-detected from the service name.
-- Validated by zod in src/app/actions/services.ts; no CHECK constraint so
-- future trade keys never need a schema change.

ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "iconKey" TEXT;
