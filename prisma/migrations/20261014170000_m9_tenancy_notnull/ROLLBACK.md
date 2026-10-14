# ROLLBACK — m9_tenancy_notnull

Reverse SQL (apply in order):

```sql
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "User" ADD COLUMN "businessId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Business" ALTER COLUMN "timezone" DROP NOT NULL;
ALTER TABLE "Business" ALTER COLUMN "timezone" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "businessId" DROP NOT NULL;
```

Data notes:
- `User.role` / `User.businessId` values are NOT recoverable from the columns
  themselves after the drop. Before rolling back, re-backfill from Membership
  (M1 mapping in reverse): one row per ACTIVE membership, role copied verbatim.
  Users with no ACTIVE membership get `businessId = NULL`, `role = 'ADMIN'`.
- Requires the pre-M9 code (which reads User.role/User.businessId) to be
  redeployed alongside.
