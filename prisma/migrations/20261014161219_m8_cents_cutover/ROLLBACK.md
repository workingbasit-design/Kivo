# Rollback: M8 cents cutover

This is a data-destroying migration (Float columns dropped). Rollback
requires the previous release's code AND the 7-day staging soak to have
passed with no cents-only writes unaccounted for.

Reverse SQL (re-add Float columns, backfill from cents — cents are the
source of truth, so no precision is lost):
```sql
-- repeat per table, e.g.:
ALTER TABLE "Invoice" ADD COLUMN "total" DOUBLE PRECISION;
UPDATE "Invoice" SET "total" = "totalCents"::double precision / 100;
-- ... for every dropped Float column (see migration.sql for the full list)
-- Quote.discountValue was NOT dropped (percent kept) — no action needed.
```
Then `prisma migrate resolve --rolled-back 20261014161219_m8_cents_cutover`
and redeploy the previous release (which dual-writes Float + cents).
Data check before rollback: `SELECT count(*) FROM "<T>" WHERE
"<c>Cents" IS NULL` must be 0 for every NOT NULL cents column — otherwise
rows written by the new code after cutover would lose money data.
