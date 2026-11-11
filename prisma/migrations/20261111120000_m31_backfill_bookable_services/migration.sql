-- m31 (M1): backfill BookableService for existing booking pages.
--
-- The BookableService model existed but nothing ever read or wrote it:
-- /book/[slug] listed every Service row for the business, so price-book-only
-- lines (callout minimums, parts, subcontract items) were publicly bookable
-- and any new service appeared on the public page the moment it was created.
--
-- The page now reads BookableService. Without this backfill every live
-- booking page would go blank the moment that change deploys, so seed the
-- curated list from what each page was already effectively offering: all of
-- that business's services, ordered by name (the order the page used).
-- Owners can then untick what should not be public, in Settings > Online
-- booking. New services are deliberately NOT bookable until ticked.
--
-- Idempotent: ON CONFLICT DO NOTHING against the
-- unique(bookingPageId, serviceId) key, so re-running changes nothing and
-- it will not clobber a list an owner has already curated.
INSERT INTO "BookableService" ("id", "bookingPageId", "serviceId", "businessId", "position", "active", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  bp."id",
  s."id",
  bp."businessId",
  (row_number() OVER (PARTITION BY bp."id" ORDER BY s."name" ASC))::int - 1,
  true,
  NOW(),
  NOW()
FROM "BookingPage" bp
JOIN "Service" s ON s."businessId" = bp."businessId"
ON CONFLICT ("bookingPageId", "serviceId") DO NOTHING;
